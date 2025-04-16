import re
from config import MALAYSIAN_CHINESE_SURNAMES

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
