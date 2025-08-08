# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Asian name ethnicity classifier that processes CSV files containing employee data and predicts ethnicity based on names. The system supports Malaysian ethnicities (Malay, Chinese, Indian) as well as other Asian countries (Myanmar, Nepal, Bangladesh). The system uses a multi-phase hybrid cascading approach:

1. **Rule-based classification**: Fast pattern matching for clear cases with confidence scoring
2. **AI classification**: OpenRouter API for uncertain cases using batch processing
3. **Extended rule-based classification**: Additional patterns for Myanmar, Nepal, Bangladesh
4. **Enhanced AI classification**: Country-specific prompts for remaining uncertain cases

All classifications include confidence scores (0.0-1.0) to indicate prediction reliability.

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

1. **Phase 1**: Intelligent column detection to identify name field
2. **Phase 2**: Rule-based classification with confidence scoring 
   - Malaysian patterns (Malay, Chinese, Indian)
   - Extended patterns (Myanmar, Nepal, Bangladesh)
3. **Phase 3**: AI classification with comprehensive country patterns for uncertain/low-confidence names
4. Save results after each batch to prevent data loss
5. Output CSV with added `ethnicity` and `confidence` columns

### Classification Logic

**Malaysian Rule-based patterns:**
- Malay: Contains "BIN" or "BINTI" (confidence: 1.0)
- Indian: Contains "A/P", "A/L", "ANAK", "S/O", or "D/O" (confidence: 0.95)
- Chinese: Matches surnames in `MALAYSIAN_CHINESE_SURNAMES` list (confidence: 0.85)

**Extended Rule-based patterns:**
- Myanmar: Honorifics (U, Daw, Saw) + name elements (Aung, Win, Thant) + no surname structure
- Nepal: Caste-based surnames (Sharma, Shrestha, Thapa, Gurung, etc.)
- Bangladesh: Islamic patterns + specific surnames (Rahman, Hossain) + female markers (Khatun, Begum)

**Confidence Scoring:**
- 1.0: Definitive patterns (e.g., BIN/BINTI)
- 0.8-0.99: Strong indicators
- 0.6-0.79: Clear patterns with some uncertainty
- Below 0.6: Marked as "Uncertain"

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

### Additional Configuration Options
- `MIN_CONFIDENCE_THRESHOLD`: Minimum confidence to accept classification (default: 0.6)
- `COLUMN_DETECTION_THRESHOLD`: Confidence threshold for automatic column detection (default: 0.6)

### Key Configuration Points
- Chinese surnames list in `config.py:MALAYSIAN_CHINESE_SURNAMES`
- Extended country patterns in `config.py` (Myanmar, Nepal, Bangladesh)
- Confidence thresholds in `config.py:RULE_BASED_CONFIDENCE`
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
- New `confidence` column added alongside `ethnicity`
- Intermediate saves protect against processing interruptions

### Output Format
The output CSV includes all original columns plus:
- `ethnicity`: Predicted ethnicity (Malay, Chinese, Indian, Myanmar, Nepal, Bangladesh, Uncertain)
- `confidence`: Confidence score between 0.0 and 1.0

### Performance Optimization
- Rule-based classification processes all names first (fastest)
- AI classification only for uncertain/low-confidence cases
- Extended AI classification uses smaller batches for better accuracy
- Confidence thresholds allow filtering results by reliability

### Testing Strategy
Manual testing only - no automated test framework per project requirements.

## Code Style Notes
- Uses Python 3.11+ features (union types with `|`)
- Pydantic models for AI response validation
- Comprehensive logging for debugging and monitoring
- Functional approach with clear separation of concerns