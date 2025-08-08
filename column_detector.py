import pandas as pd
import logging
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
import instructor
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type
import os
from dotenv import load_dotenv
from textwrap import dedent
from config import MODEL_NAME, COLUMN_DETECTION_THRESHOLD

# Load environment variables
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
HTTP_REFERER = os.getenv("HTTP_REFERER", "")
SITE_NAME = os.getenv("SITE_NAME", "")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ColumnDetectionResponse(BaseModel):
    detected_column: str = Field(..., description="The name of the column identified as containing names")
    confidence_score: float = Field(..., description="Confidence level from 0.0 to 1.0")
    reasoning: str = Field(..., description="Explanation of why this column was selected")
    alternatives: List[str] = Field(default_factory=list, description="Other potential name columns considered")

# Initialize AI client (reuse pattern from classifiers.py)
client = None
if OPENROUTER_API_KEY:
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
        client = instructor.from_openai(client)
        logging.info("OpenRouter client initialized for column detection.")
    except Exception as e:
        logging.error(f"Failed to initialize OpenRouter client for column detection: {e}")
else:
    logging.warning("OpenRouter client not available for column detection. Will use fallback methods.")

def _analyze_column_content(df: pd.DataFrame, sample_size: int = 5) -> Dict:
    """
    Analyze column characteristics to help with name detection.
    
    Args:
        df: The DataFrame to analyze
        sample_size: Number of rows to sample for analysis
        
    Returns:
        Dictionary containing column analysis data
    """
    analysis = {
        "headers": list(df.columns),
        "sample_data": {},
        "column_stats": {}
    }
    
    # Get sample data (first few rows)
    sample_df = df.head(sample_size)
    
    for col in df.columns:
        # Get sample values (non-null only)
        sample_values = sample_df[col].dropna().astype(str).tolist()
        analysis["sample_data"][col] = sample_values
        
        # Basic statistics
        analysis["column_stats"][col] = {
            "non_null_count": len(sample_values),
            "avg_length": sum(len(str(val)) for val in sample_values) / len(sample_values) if sample_values else 0,
            "contains_spaces": sum(1 for val in sample_values if " " in str(val)) / len(sample_values) if sample_values else 0,
            "dtype": str(df[col].dtype)
        }
    
    return analysis

def _build_detection_prompt(analysis: Dict) -> str:
    """
    Build a structured prompt for AI-powered column detection.
    
    Args:
        analysis: Column analysis data from _analyze_column_content
        
    Returns:
        Formatted prompt string
    """
    headers = analysis["headers"]
    sample_data = analysis["sample_data"]
    
    # Build sample data section
    sample_lines = []
    for col in headers:
        samples = sample_data.get(col, [])
        sample_str = ', '.join(samples[:3]) if samples else "No data"
        sample_lines.append(f"{col}: {sample_str}")
    
    prompt = dedent(f"""
        You are an expert at analyzing CSV data structures. Your task is to identify which column contains FULL NAMES of people.

        CSV has {len(headers)} columns: {', '.join(headers)}

        Sample data from each column:
        {chr(10).join(sample_lines)}

        Requirements:
        - Look for columns containing FULL NAMES (first + last names, or full names)
        - Prefer columns with multiple words separated by spaces
        - Avoid columns with IDs, codes, email addresses, or single words
        - Consider column names that suggest names (e.g., "name", "fullname", "employee_name")
        - If multiple candidates exist, choose the most complete/comprehensive one
        - Provide confidence score (0.0-1.0) based on certainty
        - If no suitable column exists, set detected_column to "NONE_FOUND"

        Analyze and identify the best name column from the available options.
    """).strip()
    
    return prompt

def _fallback_detection(df: pd.DataFrame) -> Optional[str]:
    """
    Rule-based fallback detection when AI is unavailable.
    
    Args:
        df: The DataFrame to analyze
        
    Returns:
        Best guess column name or None if no suitable column found
    """
    # Priority order of common name column patterns
    name_patterns = [
        "fullname", "full_name", "name", "fullName", "Full_Name",
        "employee_name", "employeename", "person_name", "personname",
        "first_last_name", "complete_name", "full name"
    ]
    
    # Check for exact matches first
    for pattern in name_patterns:
        if pattern in df.columns:
            logging.info(f"Fallback detection found exact match: {pattern}")
            return pattern
    
    # Check for case-insensitive partial matches
    for col in df.columns:
        col_lower = col.lower()
        for pattern in name_patterns:
            if pattern.lower() in col_lower:
                logging.info(f"Fallback detection found partial match: {col} (matched pattern: {pattern})")
                return col
    
    # If no pattern matches, look for columns with space-separated values
    for col in df.columns:
        if df[col].dtype == 'object':  # String columns only
            sample_values = df[col].dropna().head(5).astype(str)
            space_ratio = sum(1 for val in sample_values if ' ' in val and len(val.split()) >= 2) / len(sample_values) if len(sample_values) > 0 else 0
            
            if space_ratio > 0.6:  # More than 60% of values have spaces
                logging.info(f"Fallback detection found space-separated column: {col}")
                return col
    
    logging.warning("Fallback detection could not identify a suitable name column")
    return None

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2), retry=retry_if_exception_type(Exception))
def detect_name_column(df: pd.DataFrame, manual_column: Optional[str] = None) -> ColumnDetectionResponse:
    """
    Intelligently detect the column containing names in a DataFrame.
    
    Args:
        df: The DataFrame to analyze
        manual_column: Optional manual column specification to override detection
        
    Returns:
        ColumnDetectionResponse with detected column and metadata
    """
    # If manual column specified, validate and use it
    if manual_column:
        if manual_column in df.columns:
            logging.info(f"Using manually specified column: {manual_column}")
            return ColumnDetectionResponse(
                detected_column=manual_column,
                confidence_score=1.0,
                reasoning="Manually specified by user",
                alternatives=[]
            )
        else:
            logging.error(f"Manually specified column '{manual_column}' not found in DataFrame")
            raise ValueError(f"Column '{manual_column}' not found in CSV file")
    
    # Analyze column content
    analysis = _analyze_column_content(df)
    
    # Try AI-powered detection first
    if client:
        try:
            prompt = _build_detection_prompt(analysis)
            
            # Prepare optional headers for OpenRouter
            extra_headers = {}
            if HTTP_REFERER:
                extra_headers["HTTP-Referer"] = HTTP_REFERER
            if SITE_NAME:
                extra_headers["X-Title"] = SITE_NAME
            
            logging.info("Attempting AI-powered column detection...")
            response: ColumnDetectionResponse = client.chat.completions.create(
                model=MODEL_NAME,
                response_model=ColumnDetectionResponse,
                messages=[{"role": "user", "content": prompt}],
                extra_headers=extra_headers if extra_headers else None
            )
            
            # Validate AI response
            if response.detected_column == "NONE_FOUND":
                logging.warning("AI could not find a suitable name column")
                raise ValueError("No suitable name column found by AI")
            
            if response.detected_column not in df.columns:
                logging.error(f"AI suggested invalid column: {response.detected_column}")
                raise ValueError(f"AI suggested non-existent column: {response.detected_column}")
            
            # Check confidence threshold
            if response.confidence_score < COLUMN_DETECTION_THRESHOLD:
                logging.warning(f"AI confidence ({response.confidence_score:.2f}) below threshold ({COLUMN_DETECTION_THRESHOLD}). Falling back to rule-based detection.")
                raise ValueError(f"AI confidence too low: {response.confidence_score:.2f}")
            
            logging.info(f"AI detected column: {response.detected_column} (confidence: {response.confidence_score:.2f})")
            return response
            
        except Exception as e:
            logging.error(f"AI column detection failed: {e}. Falling back to rule-based detection.")
    
    # Fallback to rule-based detection
    fallback_column = _fallback_detection(df)
    if fallback_column:
        return ColumnDetectionResponse(
            detected_column=fallback_column,
            confidence_score=0.7,
            reasoning="Detected using rule-based fallback patterns",
            alternatives=[]
        )
    
    # If all methods fail
    raise ValueError("Could not detect a suitable name column in the CSV file. Please specify manually using -c/--column argument.")