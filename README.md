# Malaysian Name Ethnicity Classifier

Classifies Malaysian names by ethnicity (Malay, Chinese, Indian, or Uncertain) using rule-based patterns and AI classification via OpenRouter.

## Quick Start

```bash
# Setup
uv sync
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env (get from https://openrouter.ai/keys)

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
   - Uses OpenRouter API to access multiple AI models (OpenAI, Anthropic, Google, etc.)
   - Processes in batches to optimize API usage
   - Automatic fallback and cost optimization
   - Saves results after each batch

## Configuration

Environment variables in `.env`:
- `OPENROUTER_API_KEY`: Required for AI classification (get from https://openrouter.ai/keys)
- `MODEL_NAME`: AI model (default: openai/gpt-4.1-mini). Format: provider/model-name
- `BATCH_SIZE`: AI batch size (default: 10)
- `HTTP_REFERER`: Optional site URL for OpenRouter analytics
- `SITE_NAME`: Optional site name for OpenRouter analytics

## Requirements

- Python 3.11+
- OpenRouter API key (for uncertain name classification)
- Dependencies managed via `uv`

## Notes

- Works without OpenRouter API key (rule-based only)
- Access to 400+ AI models through single API
- Automatic cost optimization and provider fallbacks
- Results saved incrementally to prevent data loss
- Manual testing approach as per project requirements