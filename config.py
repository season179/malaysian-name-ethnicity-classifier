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