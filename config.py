import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# You can now access environment variables using os.getenv()
# Example:
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Add other configuration settings or functions as needed

# Initial list of common Malaysian/Singaporean Chinese surnames (Romanized)
# Based on Singapore data (Wikipedia) as a starting point.
MALAYSIAN_CHINESE_SURNAMES = [
    "TAN", "LIM", "LEE", "NG", "ONG", "WONG", "GOH", "CHUA", "CHAN", "KOH",
    "TEO", "ANG", "YEO", "TAY", "HO", "LOW", "TOH", "SIM", "CHONG", "CHIA",
    # Add more common surnames if identified
]