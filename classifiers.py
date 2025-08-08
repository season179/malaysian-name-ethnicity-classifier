import re
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import instructor
from openai import OpenAI
import logging
from typing import List, Literal
from textwrap import dedent
from config import (
    MALAYSIAN_CHINESE_SURNAMES, MODEL_NAME, RULE_BASED_CONFIDENCE,
    MYANMAR_HONORIFICS, MYANMAR_NAME_ELEMENTS,
    NEPAL_ALL_SURNAMES, NEPAL_BRAHMIN_SURNAMES, NEPAL_CHHETRI_SURNAMES,
    NEPAL_NEWAR_SURNAMES, NEPAL_ETHNIC_SURNAMES, NEPAL_DALIT_SURNAMES,
    BANGLADESH_SURNAMES, BANGLADESH_FEMALE_MARKERS, BANGLADESH_NAME_PREFIXES,
    MIN_CONFIDENCE_THRESHOLD
)
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
    ethnicity: Literal['Malay', 'Chinese', 'Indian', 'Myanmar', 'Nepal', 'Bangladesh', 'Uncertain'] = Field(..., description="The predicted ethnicity for the name.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0 and 1")

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

def classify_myanmar(normalized_name: str) -> tuple[bool, float]:
    """
    Check if name is likely from Myanmar.
    
    Args:
        normalized_name: The uppercase, whitespace-normalized name.
        
    Returns:
        Tuple of (is_myanmar, confidence_score)
    """
    parts = normalized_name.split()
    
    # Check for honorifics
    has_honorific = any(part in MYANMAR_HONORIFICS for part in parts)
    
    # Count Myanmar name elements
    element_count = sum(1 for part in parts for elem in MYANMAR_NAME_ELEMENTS if elem == part)
    
    # Myanmar names typically don't have surnames and are 1-3 words
    word_count = len(parts)
    typical_structure = 1 <= word_count <= 3
    
    # Calculate confidence
    if has_honorific and element_count > 0:
        return True, RULE_BASED_CONFIDENCE["MYANMAR_FULL_PATTERN"]
    elif has_honorific and typical_structure:
        return True, 0.75
    elif element_count >= 2 and typical_structure:
        return True, RULE_BASED_CONFIDENCE["MYANMAR_PARTIAL"]
    elif element_count == 1 and typical_structure and word_count <= 2:
        return True, 0.65
    
    return False, 0.0

def classify_nepal(normalized_name: str) -> tuple[bool, float]:
    """
    Check if name is likely from Nepal.
    
    Args:
        normalized_name: The uppercase, whitespace-normalized name.
        
    Returns:
        Tuple of (is_nepal, confidence_score)
    """
    parts = normalized_name.split()
    
    # Check each part against Nepal surname lists
    for part in parts:
        if part in NEPAL_BRAHMIN_SURNAMES or part in NEPAL_CHHETRI_SURNAMES:
            return True, RULE_BASED_CONFIDENCE["NEPAL_CASTE_SURNAME"]
        elif part in NEPAL_NEWAR_SURNAMES or part in NEPAL_ETHNIC_SURNAMES:
            return True, RULE_BASED_CONFIDENCE["NEPAL_CASTE_SURNAME"]
        elif part in NEPAL_DALIT_SURNAMES:
            return True, 0.9
    
    return False, 0.0

def classify_bangladesh(normalized_name: str) -> tuple[bool, float]:
    """
    Check if name is likely from Bangladesh.
    
    Args:
        normalized_name: The uppercase, whitespace-normalized name.
        
    Returns:
        Tuple of (is_bangladesh, confidence_score)
    """
    parts = normalized_name.split()
    
    # Check for prefixes
    has_prefix = any(part in BANGLADESH_NAME_PREFIXES for part in parts)
    
    # Check for surnames
    has_surname = any(part in BANGLADESH_SURNAMES for part in parts)
    
    # Check for female markers
    has_female_marker = any(part in BANGLADESH_FEMALE_MARKERS for part in parts)
    
    # Calculate confidence based on indicators
    indicator_count = sum([has_prefix, has_surname, has_female_marker])
    
    if indicator_count >= 2:
        return True, RULE_BASED_CONFIDENCE["BANGLADESH_FULL"]
    elif has_surname or has_female_marker:
        return True, 0.8
    elif has_prefix and len(parts) >= 2:
        # Common pattern: MD/MOHAMMAD + other names
        return True, RULE_BASED_CONFIDENCE["BANGLADESH_PARTIAL"]
    
    return False, 0.0

def classify_ethnicity_rules_with_confidence(full_name: str) -> tuple[str, float]:
    """
    Classifies ethnicity with confidence score using rule-based patterns.
    
    Args:
        full_name: The original full name string.
        
    Returns:
        Tuple of (ethnicity, confidence_score)
    """
    if not full_name or not isinstance(full_name, str):
        return "Uncertain", 0.0
    
    normalized = normalize_name(full_name)
    
    # Malaysian patterns (highest priority)
    if is_malay(normalized):
        return "Malay", RULE_BASED_CONFIDENCE["MALAY_PATRONYMIC"]
    
    if is_indian(normalized):
        return "Indian", RULE_BASED_CONFIDENCE["INDIAN_PATRONYMIC"]
    
    if is_chinese(normalized, MALAYSIAN_CHINESE_SURNAMES):
        return "Chinese", RULE_BASED_CONFIDENCE["CHINESE_SURNAME"]
    
    # Extended patterns for other Asian countries
    myanmar_result = classify_myanmar(normalized)
    if myanmar_result[0] and myanmar_result[1] >= MIN_CONFIDENCE_THRESHOLD:
        return "Myanmar", myanmar_result[1]
    
    nepal_result = classify_nepal(normalized)
    if nepal_result[0] and nepal_result[1] >= MIN_CONFIDENCE_THRESHOLD:
        return "Nepal", nepal_result[1]
    
    bangladesh_result = classify_bangladesh(normalized)
    if bangladesh_result[0] and bangladesh_result[1] >= MIN_CONFIDENCE_THRESHOLD:
        return "Bangladesh", bangladesh_result[1]
    
    return "Uncertain", 0.0

# Decorator for retrying the API call on specific exceptions
# Retries 2 times after the first failure, waiting 2 seconds between attempts
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2), retry=retry_if_exception_type(Exception))
def classify_batch_ai(name_batch: List[str]) -> List[tuple[str, float]]:
    """Classifies a batch of names using a single OpenRouter API call with confidence scores."""
    if not client:
        logging.error("AI Client not available. Skipping AI classification for batch.")
        return [("Uncertain", 0.0)] * len(name_batch)

    # Construct the prompt for batch processing
    formatted_names = "\n".join([f"{i+1}. {name}" for i, name in enumerate(name_batch)])
    
    prompt = dedent(f"""
        You are an expert in Asian naming conventions. Classify each name's ethnicity with confidence score.

        Ethnicities to identify:
        - Malay: Malaysian Malay names (BIN/BINTI patterns)
        - Chinese: Malaysian Chinese names  
        - Indian: Malaysian Indian names (A/P, A/L, S/O, D/O patterns)
        - Myanmar: Names from Myanmar/Burma
        - Nepal: Names from Nepal
        - Bangladesh: Names from Bangladesh
        - Uncertain: Cannot determine with reasonable confidence

        Provide confidence score (0.0-1.0):
        - 1.0: Unmistakable patterns (e.g., BIN/BINTI for Malay)
        - 0.8-0.99: Strong indicators with minimal ambiguity
        - 0.6-0.79: Clear patterns but some uncertainty
        - 0.4-0.59: Weak indicators, could be multiple ethnicities
        - Below 0.4: Mark as "Uncertain"

        Only assign an ethnicity if confidence >= 0.6, otherwise use "Uncertain".

        Country-specific patterns to help identify:
        
        Myanmar patterns:
        - No surnames, typically 1-3 words
        - Honorifics: U (men), Daw (women), Saw
        - Common elements: Aung, Win, Thant, Myat, Htun, Phyo, Kyaw
        - Examples: "U Thant", "Aung San", "Daw Suu"

        Nepal patterns:
        - Caste-based surnames are very distinctive
        - Brahmin: Sharma, Acharya, Paudel, Bhattarai
        - Chhetri: Thapa, Khadka, Rana, Shah  
        - Newar: Shrestha (very common), Maharjan, Pradhan
        - Ethnic: Gurung, Tamang, Sherpa, Limbu
        - Examples: "Ram Bahadur Thapa", "Sita Shrestha"

        Bangladesh patterns:
        - Islamic names predominant
        - Common surnames: Rahman, Hossain, Islam, Ahmed, Khan
        - Female markers: Khatun, Begum, Akter, Sultana
        - Prefixes: Mohammad/Mohammed, MD, Abdul
        - Examples: "Mohammad Rahman", "Fatima Khatun"
    """)
    
    prompt += dedent(f"""
        
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
            return [("Uncertain", 0.0)] * len(name_batch)

        # Extract ethnicities and confidence scores
        results = [(pred.ethnicity, pred.confidence) for pred in response.predictions]
        logging.info("Successfully received and parsed AI results for batch.")
        return results

    except Exception as e:
        logging.error(f"Error during AI batch classification for names {name_batch}: {e}")
        return [("Uncertain", 0.0)] * len(name_batch)
