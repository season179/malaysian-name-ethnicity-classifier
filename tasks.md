# Phase 1: Project Setup & Core I/O

- [x] Environment Setup:

    - [x] Ensure Python 3.11 is installed and accessible (python --version).

    - [x] Create a new project directory.

    - [x] Initialize a Git repository (git init).

    - [x] Set up a Python virtual environment (e.g., python -m venv .venv).

    - [x] Activate the virtual environment.

    - [x] Create a .gitignore file (add .venv/, __pycache__/, .env, *.pyc, output/).

    - [x] Install initial libraries: pip install pandas python-dotenv pydantic-ai. (Note: PydanticAI should handle OpenAI interactions; confirm if openai SDK needs separate installation later).

- [x] Project Structure:

    - [x] Create basic folders: data/ (for input CSVs), output/ (for results).

    - [x] Create main script file: main.py.

    - [x] Create a configuration helper (optional): config.py.

- [x] Configuration:

    - [x] Create a .env file.

    - [x] Add OPENAI_API_KEY= in the .env file (get the key later).

    - [x] Write code in config.py or main.py to load environment variables using dotenv.

- [x] CSV Handling:

    - [x] Write a Python function load_csv(filepath) using pandas.

        - [x] Parameterize the input file path.

        - [x] Include try-except for FileNotFoundError and potentially pandas.errors.EmptyDataError.

        - [x] Ensure it reads the header correctly.

    - [x] Write a Python function save_csv(dataframe, filepath) using pandas.

        - [x] Parameterize the output file path and DataFrame.

        - [x] Ensure it writes the header (initially).

        - [x] Use index=False.

- [x] Initial Script Flow:

    - [x] In main.py, implement the basic flow:

        - [x] Define input and output file paths (perhaps using command-line arguments later).

        - [x] Call load_csv().

        - [x] Placeholder: Add a comment for data processing steps.

        - [x] Call save_csv() to save the initially loaded data.

    - [x] Run with a sample input CSV to ensure reading/writing works.

    - [x] Commit initial setup to Git (git add ., git commit -m "Initial project setup").

# Phase 2: Rule-Based Classifier Implementation

- [x] Name Normalization:

    - [x] Create a function normalize_name(name): converts to uppercase, strips extra whitespace.

- [x] Classifier Logic:

    - [x] Malay: Create is_malay(normalized_name) checking for " BIN " or " BINTI ". (Consider adding other markers like "Haji" later if needed).

    - [x] Indian: Create is_indian(normalized_name) checking for " A/P ", " A/L ", " ANAK ". (Also check for " S/O " or " D/O " as per PRD).

    - [x] Chinese:

        - [x] Research and compile an initial list of common Malaysian Chinese surnames.

        - [x] Store this list (e.g., in config.py or a separate surnames.txt file).

        - [x] Create is_chinese(normalized_name, surname_list) checking if any surname exists as a whole word. (Consider fuzzy matching like Levenshtein distance later for variations like "Chew/Chow", but start simple).

- [x] Main Rule Classifier Function:

    - [x] Create classify_ethnicity_rules(full_name, chinese_surname_list):

        - [x] Call normalize_name().

        - [x] Apply rules in order: is_malay(), is_indian(), is_chinese(). Return ethnicity if matched.

        - [x] If no match, return "Uncertain".

- [x] Integrate into Main Script:

    - [x] Modify main.py to apply classify_ethnicity_rules() to each row's fullName.

    - [x] Add a new ethnicity column to the DataFrame.

    - [x] Update the save_csv() call to save the DataFrame with the new column.

    - [x] Test with sample data covering all rule categories and 'Uncertain'.

    - [x] Commit changes (git commit -m "Implement rule-based classifier").

# Phase 3: AI Classifier Integration

- [x] Setup PydanticAI & OpenAI:
    - [x] Ensure OpenAI API key is in .env and loaded correctly.
    - [x] Review PydanticAI documentation for OpenAI integration.
- [x] Define AI Output Structure:
    - [x] Using Pydantic (from pydantic import BaseModel, Literal), define class EthnicityPrediction(BaseModel): ethnicity: Literal['Malay', 'Chinese', 'Indian', 'Uncertain'].
- [x] AI Classification Function:
    - [x] Create classify_batch_ai(name_batch: list[str]) -> list[str]:
        - [x] Initialize PydanticAI OpenAI client (Instructor(OpenAI(api_key=...))) with model gpt-4.1-2025-04-14.
        - [x] Prepare the prompt carefully (e.g., "Classify the likely Malaysian ethnicity (Malay, Chinese, Indian, or Uncertain) for each name: {names}").
        - [x] Call the client's method (e.g., .chat.completions.create) using the prompt and response_model=EthnicityPrediction. Handle potential list responses if classifying multiple names in one call is supported effectively by PydanticAI for this task, otherwise, loop through names individually within the batch (simpler to start). -> Decided on batching.
        - [x] Implement basic error handling (try-except for API errors, connection issues). Log errors.
        - [x] Implement a simple retry mechanism (e.g., retry once or twice on failure with a short delay). -> Used tenacity.
        - [x] Return a list of predicted ethnicities (strings).
- [x] Batching Logic:
    - [x] In main.py, identify rows where ethnicity is 'Uncertain'.
    - [x] Get the list of fullName values for these rows and their original indices.
    - [x] Split the list into batches (e.g., size 10-20, make size configurable via config.py or constant).
- [x] Integrate AI Calls:
    - [x] Loop through the batches.
    - [x] For each batch, call classify_batch_ai().
    - [x] Map the results back to the main DataFrame using the indices saved earlier. Update the ethnicity column. Handle cases where AI fails for a batch (e.g., keep as 'Uncertain', log error).
    - [x] Commit changes (git commit -m "Integrate AI classifier").

# Phase 4: Integration & Concurrent Output

- [ ] Combine Classifiers:

    - [ ] Ensure the main script first runs the rule-based classification on all rows.

    - [ ] Then, identify 'Uncertain' rows and run the AI classification only on those batches.

- [ ] Implement Concurrent/Frequent Saving:

    - [ ] Choose a strategy (discuss if needed):

        - [ ] Option 1 (Simpler): After processing each AI batch (or every N rows), call save_csv() to overwrite the entire output file with the current state of the DataFrame.

        - [ ] Option 2 (Append - More Complex): Write header once. Then, after processing chunks (rule-based chunk, each AI batch), append the newly processed rows to the CSV (mode='a', header=False). Requires careful state management.

    - [ ] Implement the chosen saving strategy within the main processing loop.

- [ ] Refine Data Flow:

    - [ ] Check that data structures (DataFrame) are consistent throughout the process.

    - [ ] Ensure intermediate states are handled correctly (e.g., DataFrame updates).

- [ ] Commit changes (git commit -m "Integrate classifiers and implement frequent saving").

# Phase 5: Documentation & Handover

- [ ] Code Cleanup & Comments:

    - [ ] Review all code for clarity, add comments where logic is complex.

    - [ ] Ensure consistent formatting (consider pip install black and run black .).

    - [ ] Remove unused variables, imports, or commented-out code.

- [ ] Create README.md:

    - [ ] Purpose: Briefly explain what the script does.

    - [ ] Setup: List prerequisites (Python 3.11) and steps to set up the environment (git clone, cd, python -m venv .venv, source .venv/bin/activate or .venv\Scripts\activate, pip install -r requirements.txt). (Create requirements.txt: pip freeze > requirements.txt).

    - [ ] Configuration: Explain the .env file and the OPENAI_API_KEY.

    - [ ] Usage: Provide command-line example(s) for running main.py (e.g., python main.py --input data/input.csv --output output/result.csv). (This implies adding argument parsing, e.g., using argparse, as a final refinement).

- [ ] Document Limitations:

    - [ ] In the README, add a section on known limitations (e.g., accuracy depends on rules/AI, Chinese surname list coverage, potential AI biases, fuzzy matching not implemented).

- [ ] Final Code Commit:

    - [ ] Ensure all code and documentation files are added and committed (git add ., git commit -m "Finalize documentation and code cleanup").

    - [ ] Consider creating a Git tag (git tag v1.0).
