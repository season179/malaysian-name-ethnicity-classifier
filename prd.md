#### Purpose and Overview

This program will process a CSV file containing Malaysian employee data. The primary objective is to identify the likely ethnicity—Malay, Chinese, Indian, or Uncertain—based on each employee’s name. Output will be generated as a CSV file that includes the inferred ethnicity for every record. Two classification methods will be employed: a rule-based classifier for clear cases and a generative AI classifier for ambiguous names.

All testing for this application will be performed manually by the developer. Automated testing or scripted test frameworks are specifically out of scope for this release.

#### Data Inputs and Outputs

The program will accept a CSV file with headers similar to:
```
employeeId,fullName,mobileNumber,idType,idNumber,role,salary,bankName,accountNumber,race
```
A single row could look like:
```
88018209,MOHAMAD SAFIAN BIN CHE'ROOS,60124579024,mykad,790105-02-5503,Non-executive/Staff,2531,MBBB,156066030269,
```
The output CSV must retain all the original fields and add a new *ethnicity* column.

#### Ethnicity Categories and Classifiers

Because the focus is on Malaysian names, the program will categorize names as Malay, Chinese, Indian, or Uncertain. The decision flow involves two methods: a rule-based classifier and a generative AI assistant.

**Rule-Based Classifier:**  
1. **Malay:**  
   - Commonly use “bin” or “binti” in the name (case-insensitive).  
   - Possible improvements: consider including other typically Malay honorifics (e.g., “Haji”, “Hjh”) or patterns unique to regional naming customs.  
2. **Indian:**  
   - Commonly use “A/P”, “A/L”, or “ANAK” (case-insensitive).  
   - Possible improvements: also consider “S/O” or “D/O” in local contexts.  
3. **Chinese:**  
   - Identified by matching against a curated set of common Chinese surnames (e.g., “Tan”, “Lim”, “Lee”, “Ong”, etc.).  
   - Possible improvements: incorporate fuzzy matching to handle variations in spelling for surnames (e.g., “Chew” vs. “Chow”).  
4. **Uncertain:**  
   - Any name that does not match the above patterns is classified as Uncertain by this rule-based approach and queued for AI-driven classification.

**Generative AI Classifier:**  
All names marked Uncertain by the rule-based classifier are sent in batches to a generative AI (OpenAI *gpt-4.1-2025-04-14*) for further inference. The batch size is still to be determined. The generative AI will then return a likely ethnicity category or maintain the *Uncertain* classification if insufficient information exists.

#### Data Processing Logic

1. **Read and Parse**  
   - Extract each record’s *fullName* from the input CSV and normalize it (e.g., convert to uppercase or lowercase for pattern matching).
2. **Apply Rule-Based Classifier**  
   - Check if the name fits the Malay, Indian, or Chinese pattern.  
   - If a name is not captured by any pattern, label it as *Uncertain*.  
3. **Batch AI Inference**  
   - Gather all *Uncertain* names into batches (size to be tested and refined) and send them to the OpenAI API using *PydanticAI*.  
   - When the AI returns the classification, update the result.  
4. **Concurrent Output**  
   - Append or regularly save results to the output CSV to minimize data loss.

#### Infrastructure and Environment

The solution will be built in Python 3.11, using the following technologies:  
- **PydanticAI** for AI-related workflows.  
- **dotenv** for managing environment variables (e.g., API keys).  
- **OpenAI** as the provider for the generative AI inference (model: *gpt-4.1-2025-04-14*).  

A typical desktop or server environment will suffice for this initial iteration. Depending on the CSV file size and chosen batch sizes for AI queries, performance tuning and rate-limit considerations may be required.

#### Reporting and Storage of Results

The output CSV must include all original fields with an additional *ethnicity* column. Because preserving data is crucial, the program will write results to the output CSV as frequently as possible to avoid significant data loss if processing is interrupted. Potential future enhancements may include storing results in a database or using alternative output formats.

#### Key Success Criteria

1. **Manual Testing**  
   - All tests will be run manually by the developer. No automated tests or test scripts will be included in this release.  
2. **Accuracy**  
   - The rule-based classifier identifies most clear-cut Malay, Chinese, and Indian names.  
   - Names outside these patterns are accurately handled by the AI, unless the name truly remains Uncertain.  
3. **Reliability**  
   - The system can process large volumes without significant failures or performance bottlenecks.  
   - Batch AI inference does not exceed API rate limits.  

#### Risks and Assumptions

- Success relies on the accuracy of the rule-based patterns and the AI model.  
- The curated list of Chinese surnames must be adequately comprehensive.  
- The batch size for AI calls must be carefully chosen to avoid rate-limit issues and improve speed.  
- The scope explicitly excludes automated testing; if manual tests miss certain corner cases, production issues may arise.
