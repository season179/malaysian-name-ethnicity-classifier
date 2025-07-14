# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Malaysian name ethnicity classifier that processes CSV files containing employee data and predicts ethnicity (Malay, Chinese, Indian, or Uncertain) based on names. The system uses a two-phase approach:

1. **Rule-based classification**: Fast pattern matching for clear cases
2. **AI classification**: OpenRouter API for uncertain cases using batch processing with access to 400+ AI models

## Core Architecture

### Main Components

- **`main.py`**: Entry point and orchestration logic
  - Handles CSV I/O operations
  - Coordinates the two-phase classification process
  - Implements batch processing with intermediate saves
  - Command-line interface with `-i` (input) and `-o` (output) arguments

- **`classifiers.py`**: Classification implementations
  - Rule-based classifier using name patterns and surname lists
  - AI classifier using OpenRouter API with instructor/Pydantic validation
  - Retry logic with tenacity for API reliability
  - Automatic fallback and cost optimization via OpenRouter

- **`config.py`**: Configuration and constants
  - Environment variable loading
  - Chinese surname list (extensible)
  - Model and batch size configuration

### Data Flow

1. Load CSV with `fullName` column
2. Apply rule-based classification to all names
3. Collect names marked as "Uncertain" 
4. Process uncertain names in batches via OpenRouter API
5. Save results after each batch to prevent data loss
6. Output CSV with added `ethnicity` column

### Classification Logic

**Rule-based patterns:**
- Malay: Contains "BIN" or "BINTI" 
- Indian: Contains "A/P", "A/L", "ANAK", "S/O", or "D/O"
- Chinese: Matches surnames in `MALAYSIAN_CHINESE_SURNAMES` list
- Uncertain: No pattern match

## Development Commands

### Initial Setup
```bash
# Install dependencies using uv
uv sync

# Copy and configure environment variables
cp .env.example .env
# Edit .env to add your OPENROUTER_API_KEY (get from https://openrouter.ai/keys)
```

### Running the Classifier
```bash
# Using uv to run in the virtual environment
uv run python main.py -i input.csv -o output.csv

# Alternative: activate environment and run directly
uv shell
python main.py -i input.csv -o output.csv
```

### Dependency Management
```bash
# Install/sync all dependencies
uv sync

# Add new dependency
uv add <package-name>

# Add development dependency
uv add --dev <package-name>

# Update dependencies
uv sync --upgrade
```

## Configuration

### Environment Variables
- `OPENROUTER_API_KEY`: Required for AI classification (get from https://openrouter.ai/keys)
- `MODEL_NAME`: AI model (default: openai/gpt-4.1-mini). Format: provider/model-name
- `BATCH_SIZE`: AI processing batch size (default: 10)
- `HTTP_REFERER`: Optional site URL for OpenRouter analytics
- `SITE_NAME`: Optional site name for OpenRouter analytics

### Key Configuration Points
- Chinese surnames list in `config.py:MALAYSIAN_CHINESE_SURNAMES`
- Batch size affects API costs and processing speed
- Model selection impacts accuracy vs cost trade-offs
- OpenRouter provides access to 400+ models from multiple providers
- Automatic cost optimization and fallback handling

## Important Implementation Details

### Error Handling
- Missing API key allows rule-based-only operation
- Failed AI batches fall back to "Uncertain" classification  
- Retry logic (3 attempts, 2-second intervals) for API calls
- OpenRouter automatic fallback when providers are down
- Graceful handling of non-string names and malformed data

### Data Persistence
- Results are saved after each AI batch to prevent data loss
- Original CSV columns are preserved in output
- Intermediate saves protect against processing interruptions

### Testing Strategy
Manual testing only - no automated test framework per project requirements.

## Code Style Notes
- Uses Python 3.11+ features (union types with `|`)
- Pydantic models for AI response validation
- Comprehensive logging for debugging and monitoring
- Functional approach with clear separation of concerns