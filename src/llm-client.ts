// OpenRouter API client for name classification using LLMs

/**
 * Batch classify names using OpenRouter LLM API in a single prompt
 * @param fullNames Array of full names to classify
 * @param model Model name (e.g., 'openrouter/llama-2')
 * @param apiKey OpenRouter API key
 * @returns Array of LLMClassificationResult (order matches input)
 */
export async function classifyNamesWithLLMBatch(
    fullNames: string[],
    model: string,
    apiKey: string,
    options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<LLMClassificationResult[] | LLMClientError> {
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const systemPrompt = `
You are an expert in Malaysian demographics and onomastics. Your task is to classify the ethnicity of a batch of Malaysian full names as accurately as possible.

Malaysian naming conventions include:
- Malay names: Often contain patronymics such as 'bin', 'binti', or prefixes like 'Tengku', 'Nik', 'Wan', 'Syed', 'Raja', 'Puteri', 'Megat', 'Che'.
- Chinese names: Typically have a one-syllable surname (e.g., Tan, Lim, Lee, Wong, Ng) followed by one or two given names. Surnames are often at the start.
- Indian names: May include 'a/l' (anak lelaki), 'a/p' (anak perempuan), and common South Indian names (e.g., Muthu, Arumugam, Maniam, Raj, Kumar, etc.).
- Others: Names not fitting the above, or ambiguous cases.

Instructions:
- For each name, infer the ethnicity as one of: 'Malay', 'Chinese', 'Indian', 'Others', or 'Uncertain'.
- Respond in strict JSON array format, with one object per name, each with the following fields:
  - fullName: string (the input name)
  - predictedEthnicity: string
  - confidence: number (0 to 1, how certain you are)
  - method: always 'llm'
  - reasoning: brief explanation
  - llmModelUsed: model name
  - error: string (optional, only if an error occurs)
- If a name is ambiguous, set predictedEthnicity to 'Uncertain' and confidence below 0.7.
- Only respond with valid JSON, no extra commentary.
`;

    const userPrompt = `Classify the following names:\n${JSON.stringify(
        fullNames,
        null,
        2
    )}`;
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    const body = {
        model,
        messages,
        response_format: { type: "json_object" },
    };

    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app-domain.com", // replace as needed
        "X-Title": "Malaysian Name Ethnicity Classifier",
    };

    const maxRetries = options?.maxRetries ?? 3;
    const retryDelayMs = options?.retryDelayMs ?? 800;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) {
                // Retry on 429 (rate limit) or 5xx (server) errors
                if (
                    res.status === 429 ||
                    (res.status >= 500 && res.status < 600)
                ) {
                    throw new Error(
                        `Retryable OpenRouter API error: ${res.status} ${res.statusText}`
                    );
                }
                // Non-retryable error
                return {
                    error: `OpenRouter API error: ${res.status} ${res.statusText}`,
                    originalError: text,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                lastError = parseErr;
                if (attempt < maxRetries) {
                    await new Promise((r) =>
                        setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                    );
                    continue;
                }
                return {
                    error: `Failed to parse OpenRouter response as JSON: ${parseErr}`,
                    originalError: parseErr,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            // Extract and validate the LLM classification results
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                return {
                    error: "No content found in OpenRouter response",
                    originalError: data,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            let parsed: any;
            try {
                parsed = JSON.parse(content);
            } catch (llmJsonErr) {
                lastError = llmJsonErr;
                if (attempt < maxRetries) {
                    await new Promise((r) =>
                        setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                    );
                    continue;
                }
                return {
                    error: `Failed to parse LLM JSON output: ${llmJsonErr}`,
                    originalError: llmJsonErr,
                    requestDetails: { endpoint, body, content },
                    retryAttempt: attempt,
                };
            }
            // Validate and map results
            if (!Array.isArray(parsed)) {
                return {
                    error: "Malformed LLM batch response: not an array",
                    originalError: parsed,
                    requestDetails: { endpoint, body, content },
                    retryAttempt: attempt,
                };
            }
            // Ensure mapping to input order
            const resultMap = new Map(
                parsed.map((item: any) => [item.fullName, item])
            );
            // Map results to input order, fallback to error result if not found
            return fullNames.map((name) => {
                const item = resultMap.get(name);
                if (!item) {
                    return {
                        predictedEthnicity: "Uncertain",
                        confidence: 0,
                        method: "llm",
                        reasoning: "No result returned for this name",
                        llmModelUsed: model,
                        error: "No result",
                        fullName: name,
                    };
                }
                return {
                    predictedEthnicity: item.predictedEthnicity,
                    confidence: item.confidence,
                    method: item.method,
                    reasoning: item.reasoning,
                    llmModelUsed: item.llmModelUsed,
                    error: item.error,
                    fullName: item.fullName,
                };
            });
        } catch (err: any) {
            lastError = err;
            if (
                attempt < maxRetries &&
                (err?.message?.includes("Retryable") ||
                    err?.name === "FetchError" ||
                    err?.message?.includes("network"))
            ) {
                await new Promise((r) =>
                    setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                );
                continue;
            }
            return {
                error: err?.message || "Unknown error",
                originalError: err,
                requestDetails: { endpoint, body },
                retryAttempt: attempt,
            };
        }
    }
    return {
        error: "Max retries reached",
        originalError: lastError,
        requestDetails: { endpoint, body },
        retryAttempt: maxRetries,
    };
}

/**
 * OpenRouter API response types (partial, for classification)
 */
export interface OpenRouterMessage {
    role: string;
    content: string;
}

export interface OpenRouterChoice {
    index: number;
    message: OpenRouterMessage;
    finish_reason: string;
}

export interface OpenRouterAPIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: OpenRouterChoice[];
    usage?: Record<string, unknown>;
}

/**
 * Classifies a name using OpenRouter LLM API
 * @param fullName Full name to classify
 * @param model Model name (e.g., 'openrouter/llama-2')
 * @param apiKey OpenRouter API key
 */
export interface LLMClassificationResult {
    predictedEthnicity: string;
    confidence: number;
    method: string;
    reasoning: string;
    llmModelUsed: string;
    error?: string;
}

export interface LLMClientError {
    error: string;
    originalError?: unknown;
    requestDetails: Record<string, unknown>;
    retryAttempt: number;
}

export async function classifyNameWithLLM(
    fullName: string,
    model: string,
    apiKey: string,
    options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<LLMClassificationResult | LLMClientError> {
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    // Comprehensive system prompt for Malaysian name ethnicity classification
    const systemPrompt = `
You are an expert in Malaysian demographics and onomastics. Your task is to classify the ethnicity of a given Malaysian full name as accurately as possible. 

Malaysian naming conventions include:
- Malay names: Often contain patronymics such as 'bin', 'binti', or prefixes like 'Tengku', 'Nik', 'Wan', 'Syed', 'Raja', 'Puteri', 'Megat', 'Che'.
- Chinese names: Typically have a one-syllable surname (e.g., Tan, Lim, Lee, Wong, Ng) followed by one or two given names. Surnames are often at the start.
- Indian names: May include 'a/l' (anak lelaki), 'a/p' (anak perempuan), and common South Indian names (e.g., Muthu, Arumugam, Maniam, Raj, Kumar, etc.).
- Others: Names not fitting the above, or ambiguous cases.

Instructions:
- Infer the ethnicity as one of: 'Malay', 'Chinese', 'Indian', 'Others', or 'Uncertain'.
- Respond in strict JSON format with the following fields:
  - predictedEthnicity: string
  - confidence: number (0 to 1, how certain you are)
  - method: always 'llm'
  - reasoning: brief explanation
  - llmModelUsed: model name
  - error: string (optional, only if an error occurs)
- If the name is ambiguous, set predictedEthnicity to 'Uncertain' and confidence below 0.7.
- Only respond with valid JSON, no extra commentary.
`;
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classify the following name: ${fullName}` },
    ];

    const body = {
        model,
        messages,
        response_format: { type: "json_object" },
    };

    const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app-domain.com", // replace as needed
        "X-Title": "Malaysian Name Ethnicity Classifier",
    };

    const maxRetries = options?.maxRetries ?? 3;
    const retryDelayMs = options?.retryDelayMs ?? 800;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log("[LLM REQUEST]", { endpoint, body, attempt });
            const res = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) {
                // Retry on 429 (rate limit) or 5xx (server) errors
                if (
                    res.status === 429 ||
                    (res.status >= 500 && res.status < 600)
                ) {
                    throw new Error(
                        `Retryable OpenRouter API error: ${res.status} ${res.statusText}`
                    );
                }
                // Non-retryable error
                return {
                    error: `OpenRouter API error: ${res.status} ${res.statusText}`,
                    originalError: text,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                // Retry on parse error (sometimes LLMs return malformed JSON transiently)
                lastError = parseErr;
                if (attempt < maxRetries) {
                    await new Promise((r) =>
                        setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                    );
                    continue;
                }
                return {
                    error: `Failed to parse OpenRouter response as JSON: ${parseErr}`,
                    originalError: parseErr,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            // Extract and validate the LLM classification result
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                return {
                    error: "No content found in OpenRouter response",
                    originalError: data,
                    requestDetails: { endpoint, body },
                    retryAttempt: attempt,
                };
            }
            let parsed: LLMClassificationResult;
            try {
                parsed = JSON.parse(content);
            } catch (llmJsonErr) {
                // Retry on LLM JSON output error
                lastError = llmJsonErr;
                if (attempt < maxRetries) {
                    await new Promise((r) =>
                        setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                    );
                    continue;
                }
                return {
                    error: `Failed to parse LLM JSON output: ${llmJsonErr}`,
                    originalError: llmJsonErr,
                    requestDetails: { endpoint, body, content },
                    retryAttempt: attempt,
                };
            }
            // Validate required fields
            if (
                typeof parsed.predictedEthnicity !== "string" ||
                typeof parsed.confidence !== "number" ||
                typeof parsed.method !== "string" ||
                typeof parsed.reasoning !== "string" ||
                typeof parsed.llmModelUsed !== "string"
            ) {
                return {
                    error: "Malformed LLM response: missing required fields",
                    originalError: parsed,
                    requestDetails: { endpoint, body, content },
                    retryAttempt: attempt,
                };
            }
            return parsed;
        } catch (err: any) {
            lastError = err;
            // Retry on fetch/network errors
            if (
                attempt < maxRetries &&
                (err?.message?.includes("Retryable") ||
                    err?.name === "FetchError" ||
                    err?.message?.includes("network"))
            ) {
                await new Promise((r) =>
                    setTimeout(r, retryDelayMs * Math.pow(2, attempt))
                );
                continue;
            }
            // Non-retryable error or out of retries
            return {
                error: err?.message || "Unknown error",
                originalError: err,
                requestDetails: { endpoint, body },
                retryAttempt: attempt,
            };
        }
    }
    // If all retries failed
    return {
        error: "Max retries reached",
        originalError: lastError,
        requestDetails: { endpoint, body },
        retryAttempt: maxRetries,
    };
}
