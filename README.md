# Malaysian Name Ethnicity Classifier

A CLI tool and library for batch-classifying the ethnicity of Malaysian names from CSV files, with progress tracking, schema validation, and robust error handling.

## Features
- Stream-based CSV reading and writing (memory efficient, supports large files)
- Batch processing with configurable batch size
- Input and output schema validation using [zod](https://github.com/colinhacks/zod)
- Real-time progress reporting (percentage, count, elapsed time)
- Summary statistics on completion
- Graceful shutdown and robust error handling
- Easily extensible for custom classification logic or LLM integration

## Quick Start

### 1. Install dependencies

```
bun install
```

### 2. Prepare environment variables

Create a `.env` file in the project root (if using LLMs or API keys):

```
OPENAI_API_KEY=your-openai-key
MODEL_NAME=gpt-3.5-turbo
CONFIDENCE_THRESHOLD=0.7
```

### 3. Run the CLI

```
bun src/main.ts --input path/to/input.csv --output path/to/output.csv [--batchSize 100]
```

**Arguments:**
- `--input` or `-i`: Path to the input CSV file
- `--output` or `-o`: Path to write the output CSV file
- `--batchSize` or `-b`: (Optional) Number of records to process per batch (default: 100)

### 4. Input/Output CSV Format

The input CSV must have the following columns:
- `employeeId`, `fullName`, `mobileNumber`, `idType`, `idNumber`, `role`, `salary`, `bankName`, `accountNumber`

The output CSV will include all input columns plus:
- `inferredRace` (one of: Malay, Chinese, Indian, Others, Uncertain)

### 5. Example

```
bun src/main.ts --input data/employees.csv --output data/employees_with_ethnicity.csv --batchSize 200
```

### 6. Progress & Summary
- The CLI displays real-time processed count, percent complete, and elapsed time.
- On completion or interruption, a summary is printed with total processed, elapsed time, and rows/sec.

### 7. Custom Classification Logic
- By default, the CLI assigns `inferredRace: 'Uncertain'`.
- To use your own logic (e.g., LLM or rule-based), edit the `transformFn` in `src/main.ts`:

```ts
transformFn: (row) => ({ ...row, inferredRace: myEthnicityClassifier(row.fullName) })
```

## Development & Testing

- All CSV logic is in `src/csv-processor.ts` and fully tested in `src/csv-processor.test.ts`.
- Run tests with:
  ```
  bun test
  ```
- Input and output schemas are defined in `src/schemas.ts`.

## Error Handling & Graceful Shutdown
- Invalid config, file errors, and interruptions are handled gracefully.
- Partial results are saved if interrupted.

## Requirements
- [Bun](https://bun.sh/) runtime
- Node.js compatible for development

## License
MIT

---

**For more details, see the code and comments in each file.**
