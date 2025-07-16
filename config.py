import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- AI Model Configuration ---
# Load from environment variable or use default OpenRouter model
MODEL_NAME = os.getenv("MODEL_NAME", "openai/gpt-4.1-mini")
# Load batch size from environment variable, default to 10, ensure it's an integer
try:
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", 10))
except ValueError:
    print("Warning: BATCH_SIZE in .env is not a valid integer. Defaulting to 10.")
    BATCH_SIZE = 10

# --- Column Detection Configuration ---
# Confidence threshold for column detection (0.0 to 1.0)
try:
    COLUMN_DETECTION_THRESHOLD = float(os.getenv("COLUMN_DETECTION_THRESHOLD", 0.6))
except ValueError:
    print("Warning: COLUMN_DETECTION_THRESHOLD in .env is not a valid float. Defaulting to 0.6.")
    COLUMN_DETECTION_THRESHOLD = 0.6

# --- Rule-Based Configuration ---
# Initial list of common Malaysian/Singaporean Chinese surnames (Romanized)
# Based on Singapore data (Wikipedia) as a starting point.
MALAYSIAN_CHINESE_SURNAMES = [
    "TAN", "LIM", "LEE", "NG", "ONG", "WONG", "GOH", "CHUA", "CHAN", "KOH",
    "TEO", "ANG", "YEO", "TAY", "HO", "LOW", "TOH", "SIM", "CHONG", "CHIA",
    # Add more common surnames if identified
]

# --- Myanmar Name Patterns ---
MYANMAR_HONORIFICS = ["U", "DAW", "SAW", "SA", "SHIN", "PU", "PI", "THAMEIN"]
MYANMAR_NAME_ELEMENTS = [
    "AUNG", "WIN", "THANT", "ZIN", "MYAT", "HTUN", "PHYO", "KYAW", "HTET", 
    "THU", "MIN", "NAING", "TUN", "HLAING", "MOE", "SAN", "MAW", "THEIN",
    "SOE", "MYO", "WAI", "THAN", "LWIN", "MAUNG", "KHIN", "YE", "THIHA"
]

# --- Nepal Surname Lists by Caste/Ethnicity ---
NEPAL_BRAHMIN_SURNAMES = [
    "SHARMA", "ACHARYA", "PAUDEL", "BHATTARAI", "JOSHI", "ARYAL", "SUBEDI", 
    "TIWARI", "UPRETI", "DEVKOTA", "DHAKAL", "KOIRALA", "REGMI", "BHATTA", 
    "POKHREL", "ADHIKARI", "CHAPAGAIN", "NEUPANE", "KHANAL", "GHIMIRE",
    "LAMSAL", "GIRI", "BHANDARI", "WAGLE"
]

NEPAL_CHHETRI_SURNAMES = [
    "KHADKA", "THAPA", "BASNYAT", "BISTA", "RANA", "SHAH", "KUNWAR", 
    "RAWAT", "THAKURI", "CHAND", "MAGAR", "BOGATI", "BUDHATHOKI", 
    "MAHAT", "RAUT", "KARKI", "BOHARA", "KHATRI", "BUDHA", "ROKA",
    "PANTA", "MALLA", "KHADAYAT", "KATHAYAT"
]

NEPAL_NEWAR_SURNAMES = [
    "SHRESTHA", "MAHARJAN", "PRADHAN", "DANGOL", "BAJRACHARYA", 
    "SHAKYA", "MANANDHAR", "TULADHAR", "JOSHI", "AMATYA", "RAJBHANDARI",
    "NAKARMI", "SUWAL", "CHITRAKAR", "MOOL", "RAJKARNIKAR"
]

NEPAL_ETHNIC_SURNAMES = [
    "GURUNG", "TAMANG", "RAI", "LIMBU", "SHERPA", "MAGAR", "LAMA", 
    "GHALE", "THAKALI", "BHOTE", "YONJAN", "RUMBA", "JIMBA", "CHEMJONG",
    "PHOMBO", "LAWATI", "LOPCHAN", "THOKAR"
]

NEPAL_DALIT_SURNAMES = [
    "KAMI", "BISHWAKARMA", "B.K.", "DAMAI", "PARIYAR", "SARKI", 
    "NEPALI", "GANDHARVA", "SUNAR", "LOHAR", "CHUNARA", "PARKI",
    "KUMAL", "MUSAHAR"
]

# Combine all Nepal surnames for easy checking
NEPAL_ALL_SURNAMES = (
    NEPAL_BRAHMIN_SURNAMES + NEPAL_CHHETRI_SURNAMES + 
    NEPAL_NEWAR_SURNAMES + NEPAL_ETHNIC_SURNAMES + NEPAL_DALIT_SURNAMES
)

# --- Bangladesh Name Patterns ---
BANGLADESH_SURNAMES = [
    "RAHMAN", "HOSSAIN", "ISLAM", "AHMED", "AHMAD", "KHAN", "ALI", 
    "UDDIN", "ALAM", "KARIM", "MIAH", "CHOWDHURY", "SIKDER", "SHEIKH", 
    "MOLLA", "BHUIYAN", "SARKAR", "TALUKDAR", "BISWAS", "MANDAL",
    "HASSAN", "HUSSAIN", "BEGUM", "KHANAM", "SULTANA", "SIDDIQUE",
    "AKHTER", "HAQUE", "MOLLA", "FAKIR"
]

BANGLADESH_FEMALE_MARKERS = [
    "KHATUN", "BEGUM", "AKTER", "SULTANA", "PARVIN", "NASRIN", 
    "YASMIN", "FATIMA", "KHANAM", "NAHAR", "AKHTAR", "JAHAN"
]

BANGLADESH_NAME_PREFIXES = [
    "MOHAMMAD", "MOHAMMED", "MD", "ABDUL", "ABU", "SHEIKH", "SYED",
    "MIR", "SHAH", "KHONDOKAR", "KHAN"
]

# --- Confidence Score Configuration ---
RULE_BASED_CONFIDENCE = {
    "MALAY_PATRONYMIC": 1.0,      # BIN/BINTI patterns are definitive
    "INDIAN_PATRONYMIC": 0.95,    # A/P, A/L, S/O, D/O patterns
    "CHINESE_SURNAME": 0.85,       # Known surname match
    "MYANMAR_FULL_PATTERN": 0.9,  # Honorific + name elements
    "MYANMAR_PARTIAL": 0.7,        # Only honorific or elements
    "NEPAL_CASTE_SURNAME": 0.95,  # Clear caste surname
    "BANGLADESH_FULL": 0.9,        # Multiple Bangladesh indicators
    "BANGLADESH_PARTIAL": 0.7      # Single indicator
}

# Minimum confidence to accept a classification
try:
    MIN_CONFIDENCE_THRESHOLD = float(os.getenv("MIN_CONFIDENCE_THRESHOLD", 0.6))
except ValueError:
    print("Warning: MIN_CONFIDENCE_THRESHOLD in .env is not a valid float. Defaulting to 0.6.")
    MIN_CONFIDENCE_THRESHOLD = 0.6

