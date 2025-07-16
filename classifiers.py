import re
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import instructor
from openai import OpenAI
import logging
from typing import List, Literal
from textwrap import dedent
from config import MALAYSIAN_CHINESE_SURNAMES, MODEL_NAME
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
HTTP_REFERER = os.getenv("HTTP_REFERER", "")
SITE_NAME = os.getenv("SITE_NAME", "")

if not OPENROUTER_API_KEY:
    logging.error("OPENROUTER_API_KEY not found in .env file.")
    # Decide handling: raise error or allow non-AI operation
    # raise ValueError("OPENROUTER_API_KEY is essential for AI classification.")

# --- Pydantic Models for AI --- START
# Define the expected output structure for a single name
class EthnicityPrediction(BaseModel):
    original_name: str = Field(..., description="The original name provided in the input list.")
    ethnicity: Literal['Malay', 'Chinese', 'Indian', 'Uncertain'] = Field(..., description="The predicted ethnicity for the name.")

# Define the expected output structure for a batch of names
class BatchNameEthnicityPrediction(BaseModel):
    predictions: List[EthnicityPrediction] = Field(..., description="A list of ethnicity predictions, one for each name in the input batch.")
# --- Pydantic Models for AI --- END

# --- AI Client Initialization --- START
client = None
if OPENROUTER_API_KEY:
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
        # Patch the client using the instructor library
        client = instructor.from_openai(client)
        logging.info("OpenRouter client initialized and patched with instructor successfully.")
    except Exception as e:
        logging.error(f"Failed to initialize OpenRouter client: {e}")
else:
    logging.warning("OpenRouter client not initialized due to missing API key. AI classification will be skipped.")
# --- AI Client Initialization --- END

def normalize_name(name: str) -> str:
    """
    Normalizes a name by converting it to uppercase and stripping leading/trailing whitespace,
    and reducing multiple internal spaces to single spaces.

    Args:
        name: The input name string.

    Returns:
        The normalized name string.
    """
    if not isinstance(name, str):
        # Handle non-string inputs gracefully, maybe return an empty string or raise an error
        # For now, let's return an empty string after logging or warning.
        # Consider adding logging here if needed.
        return ""
    name = name.upper()
    name = name.strip()
    # Replace multiple whitespace characters with a single space
    name = re.sub(r'\s+', ' ', name)
    return name

def is_malay(normalized_name: str) -> bool:
    """
    Checks if a normalized name contains Malay-specific markers.

    Args:
        normalized_name: The uppercase, whitespace-normalized name.

    Returns:
        True if the name contains " BIN " or " BINTI ", False otherwise.
    """
    # Check for whole words, surrounded by spaces or start/end of string
    # Using word boundaries (\b) might be too broad if names abut punctuation
    # Safest to check for space-surrounded markers explicitly
    return " BIN " in normalized_name or " BINTI " in normalized_name

def is_indian(normalized_name: str) -> bool:
    """
    Checks if a normalized name contains Indian-specific markers.

    Args:
        normalized_name: The uppercase, whitespace-normalized name.

    Returns:
        True if the name contains " A/P ", " A/L ", " ANAK ", " S/O ", or " D/O ", False otherwise.
    """
    markers = [" A/P ", " A/L ", " ANAK ", " S/O ", " D/O "]
    return any(marker in normalized_name for marker in markers)

def is_chinese(normalized_name: str, surname_list: list[str]) -> bool:
    """
    Checks if a normalized name contains a known Chinese surname as a whole word.

    Args:
        normalized_name: The uppercase, whitespace-normalized name.
        surname_list: A list of known Chinese surnames (uppercase).

    Returns:
        True if a surname from the list is found as a whole word in the name, False otherwise.
    """
    # Split the name into parts (words)
    name_parts = normalized_name.split(' ')

    # Check if any part of the name matches any surname in the list
    for part in name_parts:
        if part in surname_list:
            return True

    # As an alternative or addition, regex could be used for more complex matching,
    # but splitting by space covers the requirement of "whole word" matching for now.
    # Example using regex:
    # for surname in surname_list:
    #     # Use word boundaries (\b) to ensure whole word match
    #     if re.search(r'\b' + re.escape(surname) + r'\b', normalized_name):
    #         return True

    return False

def classify_ethnicity_rules(full_name: str) -> str:
    """
    Classifies the ethnicity based on a set of rules.

    Args:
        full_name: The original full name string.

    Returns:
        The predicted ethnicity ('Malay', 'Indian', 'Chinese', 'Uncertain').
    """
    if not full_name or not isinstance(full_name, str):
        return "Uncertain" # Handle empty or non-string input

    normalized = normalize_name(full_name)

    if is_malay(normalized):
        return "Malay"
    if is_indian(normalized):
        return "Indian"
    # Pass the imported surname list to is_chinese
    if is_chinese(normalized, MALAYSIAN_CHINESE_SURNAMES):
        return "Chinese"

    return "Uncertain"

# Decorator for retrying the API call on specific exceptions
# Retries 2 times after the first failure, waiting 2 seconds between attempts
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2), retry=retry_if_exception_type(Exception))
def classify_batch_ai(name_batch: List[str]) -> List[str]:
    """Classifies a batch of names using a single OpenRouter API call via PydanticAI."""
    if not client:
        logging.error("AI Client not available. Skipping AI classification for batch.")
        return ["Uncertain"] * len(name_batch) # Return 'Uncertain' for all names in the batch

    # Construct the prompt for batch processing
    # Prepare names for the prompt, e.g., numbered list
    formatted_names = "\n".join([f"{i+1}. {name}" for i, name in enumerate(name_batch)])
    
    prompt = dedent(f"""
        You are an expert in Malaysian Naming Conventions. Based on typical patterns, 
        classify the likely ethnicity (Malay, Chinese, Indian, or Uncertain) for EACH name in the following list.
        
        Provide the result as a list of predictions, ensuring each prediction includes the original name and its corresponding ethnicity.
        
        The number of predictions in your response MUST match the number of names in the input list ({len(name_batch)} names).

        Input Names:
        {formatted_names}
    """).strip()

    try:
        logging.info(f"Sending batch of {len(name_batch)} names to AI model {MODEL_NAME}...")
        
        # Prepare optional headers for OpenRouter
        extra_headers = {}
        if HTTP_REFERER:
            extra_headers["HTTP-Referer"] = HTTP_REFERER
        if SITE_NAME:
            extra_headers["X-Title"] = SITE_NAME
        
        response: BatchNameEthnicityPrediction = client.chat.completions.create(
            model=MODEL_NAME,
            response_model=BatchNameEthnicityPrediction,
            messages=[{"role": "user", "content": prompt}],
            extra_headers=extra_headers if extra_headers else None
        )

        # Validate response
        if len(response.predictions) != len(name_batch):
            logging.error(f"AI response length mismatch: Expected {len(name_batch)}, Got {len(response.predictions)}. Names: {name_batch}")
            # Fallback: Return 'Uncertain' for all names in this batch
            return ["Uncertain"] * len(name_batch)

        # Extract ethnicities in the correct order (assuming AI respects the order)
        # We could add a check here to match original_name if needed, but let's trust the AI for now
        results = [pred.ethnicity for pred in response.predictions]
        logging.info("Successfully received and parsed AI results for batch.")
        return results

    except Exception as e:
        logging.error(f"Error during AI batch classification for names {name_batch}: {e}")
        # Exception might be raised by tenacity after retries fail
        # Fallback: Return 'Uncertain' for all names in this batch
        return ["Uncertain"] * len(name_batch)
