import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- OpenAI Configuration ---
# Load from environment variable or use default
OPENAI_MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4.1-2025-04-14")
# Load batch size from environment variable, default to 10, ensure it's an integer
try:
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", 10))
except ValueError:
    print("Warning: BATCH_SIZE in .env is not a valid integer. Defaulting to 10.")
    BATCH_SIZE = 10

# --- Rule-Based Configuration ---
# Initial list of common Malaysian/Singaporean Chinese surnames (Romanized)
# Based on Singapore data (Wikipedia) as a starting point.
MALAYSIAN_CHINESE_SURNAMES = [
    "TAN", "LIM", "LEE", "NG", "ONG", "WONG", "GOH", "CHUA", "CHAN", "KOH",
    "TEO", "ANG", "YEO", "TAY", "HO", "LOW", "TOH", "SIM", "CHONG", "CHIA",
    # Add more common surnames if identified
]