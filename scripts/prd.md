# PRD: Malaysian Name Ethnicity Classifier

**Version:** 1.0
**Date:** 2025-04-14

## 1. Introduction & Goal

This document outlines the plan for developing a system to classify Malaysian names into predefined ethnic categories. The system will read employee data from a CSV file, infer the ethnicity based on the `fullName` field, and write the results incrementally to a new output CSV file.

The primary goal is to provide a *probabilistic* classification to assist with data analysis, acknowledging the inherent limitations and complexities of inferring ethnicity from names.

## 2. Core Idea

The system will employ a hybrid approach:

1.  **Rule-Based Classification:** Apply a set of predefined rules based on known Malaysian naming conventions (e.g., patronymics, titles, specific surnames) to identify high-confidence matches for certain ethnic groups.
2.  **LLM-Based Classification:** For names not matched by the rules, leverage a Large Language Model (LLM) via OpenRouter, providing specific context about Malaysian naming patterns to infer the most likely ethnicity.

Processing will occur incrementally in batches to handle large files efficiently and provide faster output updates.

## 3. Input / Output Format

* **Input:** A CSV file (`input.csv`) with the following headers:
    `employeeId,fullName,mobileNumber,idType,idNumber,role,idNumber_1,salary,bankName,accountNumber,race,Inferred Race`
* **Output:** A *new* CSV file (`output.csv`) with the exact same headers as the input file. The `Inferred Race` column in the output file will be populated by this system based on the classification of the `fullName` column. The original value in the input `Inferred Race` column will be ignored.

## 4. Target Ethnicity Categories

The system will attempt to classify names into one of the following categories:

* Malay
* Chinese
* Indian
* Others (Includes indigenous groups of Peninsular Malaysia, Sabah, Sarawak, Eurasians, Thais, etc.)
* Uncertain (Used when the system cannot make a classification with reasonable confidence or encounters errors).

## 5. Tech Stack

* **Language:** TypeScript
* **Runtime:** Bun
* **Validation:** Zod
* **AI Provider:** OpenRouter
* **Environment Variables:** `dotenv` package
* **CSV Handling:** Bun's built-in file I/O (`Bun.file`, streams) potentially combined with a streaming CSV library (e.g., `csv-parse`, `csv-stringify` or alternatives).
* **API Client:** Bun's built-in `fetch` or a library like `ofetch`.

## 6. Implementation Plan

### Phase 1: Project Setup & Foundation (Est. Time: 0.5 - 1 day)

* **Task 1: Initialize Project:**
    * Use `bun init` to create a new Bun project with TypeScript support.
    * Initialize a Git repository (`git init`) and create an initial commit.
    * Configure `tsconfig.json` for strict type checking, ESNext modules, and appropriate target.
* **Task 2: Install Dependencies:**
    * Run `bun add zod`.
    * Run `bun add dotenv`.
    * Evaluate and install CSV handling libraries if needed (e.g., `bun add csv-parse csv-stringify`). Decide if Bun's built-ins are sufficient.
    * Decide on and install fetch client if not using Bun's built-in `fetch` (e.g., `bun add ofetch`).
* **Task 3: Environment Configuration:**
    * Create a `.env` file in the project root.
    * Add necessary environment variables: `OPENROUTER_API_KEY`, `LLM_MODEL` (e.g., `anthropic/claude-3-haiku-20240307`), `BATCH_SIZE` (e.g., `100`).
    * Add `.env` to the `.gitignore` file.
    * Ensure `dotenv.config()` is called early in the application entry point to load these variables.
* **Task 4: Define Core Data Structures (Zod Schemas):**
    * `InputCsvRowSchema`: Define a Zod schema for validating rows read from the input CSV. Must include all specified columns (`employeeId: z.string()`, `fullName: z.string()`, etc.). Use appropriate types (e.g., `z.string()`, `z.number().optional()`). Use `.passthrough()` if unlisted columns should be preserved.
    * `EthnicityEnumSchema`: Define `z.enum(['Malay', 'Chinese', 'Indian', 'Others', 'Uncertain'])`.
    * `ClassificationResultSchema`: Define the structured output of the internal classification logic: `{ predictedEthnicity: EthnicityEnumSchema, confidence: z.enum(['High', 'Medium', 'Low']), method: z.enum(['RuleBased', 'LLM']), reasoning: z.string().optional(), llmModelUsed: z.string().optional() }`. Add an `error?: z.string()` field for capturing classification errors per record.
    * `OutputCsvRowSchema`: Define the Zod schema for the data *before* it's written to the output CSV. This should mirror `InputCsvRowSchema` but ensure the `Inferred Race` field is populated based on the `ClassificationResultSchema`. Define the mapping clearly (e.g., the output `Inferred Race` column might store a string like `"${result.predictedEthnicity} (${result.confidence})"` or just `result.predictedEthnicity`).
    * `ConfigSchema`: Define a Zod schema to parse and validate runtime configuration derived from environment variables (API Key, Model, Batch Size) and potentially command-line arguments (input/output file paths).

### Phase 2: Rule-Based Classifier Implementation (Est. Time: 1 - 2 days)

* **Task 5: Research & Compile Rules/Keywords:**
    * Conduct thorough research specific to Malaysian naming conventions for high-confidence identification.
    * Compile lists/patterns for:
        * **Malay:** Patronymics (`bin`, `binti`, `b.`, `bt.`, `bte.`), common hereditary titles (`Syed`, `Sharifah`, `Wan`, `Nik`, `Tunku`, `Raja`, `Megat`, `Puteri`, `Awang`, `Dayang`, `Che`), common first name prefixes (`Muhammad`/`Mohd`/`Md`, `Nur`/`Nurul`/`Nor`, `Siti`/`Ct`). Note potential ambiguities.
        * **Indian:** Patronymics (`a/l`, `a/p`), common Sikh surnames (`Singh`, `Kaur`). Research common Tamil, Telugu, Punjabi etc. surnames *specifically prevalent in Malaysia* (use with caution, less definitive).
        * **Chinese:** List common Malaysian Chinese surnames (`Tan`, `Lim`, `Lee`, `Ng`, `Ong`, `Wong`, etc.). Analyze typical structure (e.g., single-syllable surname followed by two-syllable given name - heuristic).
    * Store these rules effectively (e.g., constants, JSON configuration file).
* **Task 6: Implement Rule-Based Classifier Function:**
    * Create a pure TypeScript function: `classifyByNameRules(fullName: string): ClassificationResult | null`.
    * Input: Sanitized full name (e.g., trimmed, consistent case).
    * Logic: Apply the compiled rules (Task 5) sequentially based on confidence/precedence. Handle variations in spelling/abbreviations.
    * Output: If a high-confidence rule matches, return a `ClassificationResult` object (`method: 'RuleBased'`, `confidence: 'High'`, appropriate `predictedEthnicity`). Otherwise, return `null`.

### Phase 3: LLM Integration via OpenRouter (Est. Time: 2 - 3 days)

* **Task 7: Select Initial LLM Models on OpenRouter:**
    * Identify 1-3 candidate models available via OpenRouter, considering cost, speed, context window, and perceived capability for this nuanced task. Examples: `anthropic/claude-3-haiku-20240307`, `anthropic/claude-3-sonnet-20240229`, `openai/gpt-4o`, `google/gemini-1.5-flash-latest`. Make the chosen model configurable via `.env`.
* **Task 8: Design Prompt Strategy:**
    * Develop robust system and user prompts for the LLM API call.
    * **System Prompt:** Define the AI's role ("expert in Malaysian names and culture"), the specific task (classify into Malay, Chinese, Indian, Others, Uncertain), provide detailed context on naming conventions for each group in Malaysia (mentioning patronymics, titles, common structures, diversity of Indian/Others groups, location context: Kuala Lumpur/Malaysia), instruct on handling ambiguity, and strictly define the required JSON output format.
    * **JSON Output Format:** Explicitly request JSON: `{ "predictedEthnicity": "[Malay|Chinese|Indian|Others|Uncertain]", "reasoning": "[Brief explanation]", "confidence": "[High|Medium|Low]" }`.
    * **User Prompt:** Simply provide the `fullName` to be classified.
* **Task 9: Implement OpenRouter API Client Logic:**
    * Create an async TypeScript function: `classifyNameWithLLM(fullName: string, model: string, apiKey: string): Promise<any>`.
    * Use `fetch` to make a POST request to the OpenRouter `/chat/completions` endpoint.
    * Set `Authorization: Bearer <apiKey>` header.
    * Include recommended OpenRouter headers (`HTTP-Referer`, `X-Title`).
    * Send the system prompt, user prompt (with the name), and request JSON output mode if supported by the model/OpenRouter.
    * Implement error handling for network issues, API status codes (4xx, 5xx), rate limits. Include basic retry logic if appropriate.
* **Task 10: Implement LLM Response Parser & Validator:**
    * Create a function: `parseLLMResponse(response: any): ClassificationResult | null`.
    * Input: The raw response body from the OpenRouter API call.
    * Logic: Try to parse the response body as JSON. Use a Zod schema (`llmResponseSchema`) reflecting the requested JSON structure (from Task 8) to validate the parsed object using `.safeParse()`.
    * Output: If parsing and validation succeed, map the validated data to the standard `ClassificationResult` schema (`method: 'LLM'`, map `predictedEthnicity`, `reasoning`, `confidence`). If parsing or validation fails, log the error and the invalid response, then return `null` or a `ClassificationResult` indicating failure/uncertainty.

### Phase 4: CSV Processing & Orchestration (Est. Time: 2 - 4 days)

* **Task 11: Implement Core Classification Orchestrator:**
    * Create the main async classification function: `classifyMalaysianName(fullName: string): Promise<ClassificationResult>`.
    * Input: A single full name string.
    * Logic:
        1.  Sanitize the `fullName`.
        2.  Call `classifyByNameRules()`. If a result is returned, return it.
        3.  If no rule match, call `classifyNameWithLLM()` (using configured model/key).
        4.  Call `parseLLMResponse()` on the LLM result.
        5.  If LLM parsing successful, return the LLM result.
        6.  If any step fails (e.g., LLM API error, parsing error), catch the error, log it, and return a default `ClassificationResult` (e.g., `{ predictedEthnicity: 'Uncertain', confidence: 'Low', method: 'LLM', error: 'Classification failed: [reason]' }`).
    * Output: A guaranteed `ClassificationResult` object.
* **Task 12: Setup CSV Input Stream/Reader:**
    * Implement logic to handle the input CSV file path (provided via CLI args or config).
    * Use `Bun.file(inputFile).stream()` for efficient reading of large files.
    * Process the stream line-by-line or use a streaming CSV parser library.
    * Read and store the header row to be used for the output file. Handle potential errors during file reading (e.g., file not found, permissions).
* **Task 13: Setup CSV Output Writer:**
    * Implement logic to handle the output CSV file path.
    * Use `Bun.file(outputFile).writer()` to get a file writer object.
    * Immediately write the stored header row (from Task 12) to the output file using `writer.write()`. Handle potential file creation/writing errors.
* **Task 14: Implement Batch Processing Loop:**
    * Initialize an empty array for the current batch: `processedBatch: OutputCsvRowSchema[] = []`.
    * Retrieve `BATCH_SIZE` from configuration (e.g., 100).
    * Initialize record counter `recordCount = 0`.
    * Asynchronously iterate through the input CSV rows/stream (Task 12), skipping the header row:
        * Increment `recordCount`.
        * Parse the raw row data into an object. Validate using `InputCsvRowSchema.safeParse()`. If invalid, log an error with the record number and potentially skip the row or mark it as an error.
        * Extract `fullName` from the validated input row object.
        * Call `classificationResult = await classifyMalaysianName(fullName)`.
        * Construct the `outputRow` object (`OutputCsvRowSchema`): Copy all data from the validated input row object, then populate the `Inferred Race` column (and potentially others like confidence/method/reasoning if adding new columns) based on the `classificationResult`.
        * Add the `outputRow` to `processedBatch`.
        * Log progress periodically (e.g., every 100 records: `console.log(\`Processed record ${recordCount}...\`)`).
        * If `processedBatch.length >= BATCH_SIZE`:
            * Call `await writeBatchToCsv(processedBatch, csvWriter)` (Task 15).
            * Log batch write: `console.log(\`Wrote batch ${batchCount} (Records: ${processedBatch.length})...\`)`.
            * Clear `processedBatch`.
    * After the loop finishes, if `processedBatch` is not empty, write the final remaining batch.
    * Ensure the output writer is closed: `writer.end()`.
* **Task 15: Implement Batch CSV Writing Function:**
    * Create async function `writeBatchToCsv(batch: OutputCsvRowSchema[], writer: Bun.FileWriter)`.
    * Convert the array of `outputRow` objects into a single multi-line CSV formatted string. Ensure proper quoting and escaping of values containing commas, quotes, or newlines (use `csv-stringify` library function or implement carefully).
    * Use `await writer.write(batchCsvString)` to append the formatted batch string to the output file.
    * Call `await writer.flush()` to ensure data is written to the OS buffer.

### Phase 5: Evaluation & Refinement (Est. Time: 2 - 3 days + Ongoing)

* **Task 16: Adapt Evaluation Strategy & Dataset:**
    * **Crucial & Difficult:** Create a representative evaluation dataset.
    * Prepare a test input CSV (`evaluation_input.csv`) containing diverse Malaysian names across all target categories (Malay, Chinese, various Indian groups, various Indigenous/Others groups). Include a reliable `ground_truth_ethnicity` column in this file. Aim for at least a few hundred records if possible.
    * Run the main processing script using `evaluation_input.csv` to generate `evaluation_output.csv`.
    * Develop a separate evaluation script (`evaluate.ts`) that:
        * Reads `evaluation_output.csv`.
        * Compares the generated `Inferred Race` column against the `ground_truth_ethnicity` column.
        * Calculates and reports metrics: Overall Accuracy, Precision/Recall/F1-score *per ethnic category*, Confusion Matrix.
* **Task 17: Implement Basic Testing (Unit/Integration):**
    * Write unit tests for `classifyByNameRules` with various name patterns.
    * Write unit tests for `parseLLMResponse` with mock valid/invalid API responses.
    * Write integration tests for the main orchestrator (`classifyMalaysianName`), mocking the API call.
    * Write integration tests for the CSV batch processing loop, mocking file I/O and the classifier function to test batching and writing logic.
* **Task 18: Run Evaluation & Analyze Results:**
    * Execute the evaluation script (Task 16) on the output generated from the test dataset.
    * Carefully analyze the metrics and confusion matrix. Identify specific weaknesses: Which groups are poorly classified? What kinds of names cause errors? Are 'Others' mostly classified as 'Uncertain'?
* **Task 19: Refine Rules, Prompts, Models:**
    * Based on evaluation analysis (Task 18):
        * Adjust, add, or remove patterns in the rule-based classifier (Task 5 & 6).
        * Iterate on the LLM prompt (Task 8) to improve context, instructions, or output format adherence.
        * Experiment by changing the `LLM_MODEL` environment variable (Task 7) and re-evaluating.
* **Task 20: Add Confidence Mapping to Output:**
    * Finalize how the `confidence` level (`High`, `Medium`, `Low`) from the `ClassificationResult` is represented in the output CSV's `Inferred Race` column (e.g., "Malay (High)", "Indian (Low)") or if a separate `Inferred Confidence` column should be added. Update `OutputCsvRowSchema` and the mapping logic in Task 14 accordingly.
* **Task 21: Implement Caching (Optional but Recommended):**
    * Implement an in-memory cache (e.g., `const cache = new Map<string, ClassificationResult>();`).
    * Before calling `classifyMalaysianName`'s core logic (rules/LLM), check if the sanitized `fullName` exists in the cache. If yes, return the cached result.
    * If not cached, perform classification, then store the result in the cache before returning it.
    * Log cache hits/misses. Consider cache size limits if memory is a concern for very large unique name sets.
* **Task 22: Enhance Error Handling & Logging:**
    * Implement robust error handling for file operations (permissions, disk full), API calls (rate limits, timeouts, specific error codes), CSV parsing errors, and unexpected runtime exceptions.
    * Use a structured logging library (e.g., `pino`) for better log management. Log key events: start/end of processing, batch writes, record-specific errors (with record number/ID), API call details (model used, latency), cache usage, final summary (total records processed, errors encountered).
* **Task 23: Documentation:**
    * Ensure comprehensive TSDoc comments for functions and interfaces.
    * Create/update the `README.md` file:
        * Project overview and goal.
        * Detailed setup instructions (cloning, `bun install`, `.env` setup).
        * Clear instructions on how to run the script (e.g., `bun run src/main.ts --input <path> --output <path>`).
        * Explanation of configuration options (`.env` variables).
        * Description of the input/output CSV format.
        * **Mandatory Section: Limitations and Ethical Considerations:** Explicitly detail the probabilistic nature, expected inaccuracies (especially for Indian/Others/Mixed), the social sensitivity of ethnicity in Malaysia, potential biases in rules/LLM/data, and strongly advise against using the output for discriminatory purposes, critical decisions, or assuming it represents ground truth without verification.

### Phase 6: Execution & Monitoring (Est. Time: 0.5 day + Runtime)

* **Task 24: Create Main Execution Script:**
    * Structure the main entry point script (e.g., `src/main.ts`).
    * Use `dotenv.config()` at the top.
    * Implement command-line argument parsing for `--input` and `--output` file paths (e.g., using `Bun.argv` or a library like `yargs`). Validate arguments.
    * Load configuration (API key, model, batch size) from environment variables (validated by `ConfigSchema`).
    * Instantiate necessary components (reader, writer).
    * Call the main batch processing loop (Task 14).
    * Implement real-time progress reporting to the console (e.g., using `process.stdout.write` for overwriting lines or simple `console.log`).
    * Implement graceful shutdown logic (e.g., using `process.on('SIGINT', async () => { ... })`) to ensure the output file writer is properly closed and final batches are written if the script is interrupted (Ctrl+C).
    * Log final summary statistics upon successful completion.

## 7. Limitations & Ethical Considerations

This section must be clearly communicated alongside the tool.

* **Probabilistic Nature:** The classification is based on patterns and AI inference, not definitive knowledge. It will produce errors.
* **Accuracy Varies:** Accuracy will likely be higher for groups with very distinct naming patterns (e.g., typical Malay names with patronymics) and lower for highly diverse groups (Indian Malaysians, Indigenous groups/'Others') or those with overlapping patterns.
* **Inability to Capture Self-Identity:** This tool cannot capture an individual's self-identified ethnicity, which is the most meaningful measure.
* **Bias Potential:** The rules compiled and the knowledge within the LLM may reflect existing societal biases. The tool might perform differently for different subgroups within the main categories.
* **Sensitivity in Malaysia:** Ethnicity is a complex and sensitive topic in Malaysia. Misclassification could be offensive or misinterpreted.
* **Misuse Potential:** The output should **not** be used as a sole basis for any critical decisions, profiling, or actions that could lead to discrimination or exclusion. It is intended for analytical assistance with awareness of its flaws.
* **Data Privacy:** Ensure the handling of the input CSV data complies with relevant privacy regulations and ethical guidelines.

The output `Inferred Race` column should be treated as a *suggestion* or *hypothesis* requiring further verification if accuracy is critical.
