# Malaysian Name Ethnicity Classifier

Classifies Malaysian names by ethnicity (Malay, Chinese, Indian, or Uncertain) using rule-based patterns and AI classification.

## Quick Start

```bash
# Setup
uv sync
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Run classification
uv run python main.py -i input.csv -o output.csv
```

## Input Format

CSV file with a `fullName` column:
```csv
employeeId,fullName,mobileNumber,idType,idNumber,role,salary,bankName,accountNumber
88928249,MOHAMAD SYED BIN CHE'GOOS,60128729024,mykad,790409-02-5308,Non-executive/Staff,2531,MBBB,186026040269
```

## Output

Same CSV with added `ethnicity` column containing: `Malay`, `Chinese`, `Indian`, or `Uncertain`.

## How It Works

1. **Rule-based classification** (fast):
   - Malay: Contains "BIN" or "BINTI"
   - Indian: Contains "A/P", "A/L", "ANAK", "S/O", "D/O"
   - Chinese: Matches known Chinese surnames list

2. **AI classification** (for uncertain cases):
   - Uses OpenAI GPT model for ambiguous names
   - Processes in batches to optimize API usage
   - Saves results after each batch

## Configuration

Environment variables in `.env`:
- `OPENAI_API_KEY`: Required for AI classification
- `MODEL_NAME`: OpenAI model (default: gpt-4.1-2025-04-14)
- `BATCH_SIZE`: AI batch size (default: 10)

## Requirements

- Python 3.11+
- OpenAI API key (for uncertain name classification)
- Dependencies managed via `uv`

## Notes

- Works without OpenAI API key (rule-based only)
- Results saved incrementally to prevent data loss
- Manual testing approach as per project requirements