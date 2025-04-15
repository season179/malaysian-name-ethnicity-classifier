import { z } from 'zod';

// Standard ClassificationResult type for the project
export type ClassificationResult = {
  predictedEthnicity: string; // 'Malay' | 'Chinese' | 'Indian' | 'Others' | 'Uncertain'
  confidence: number; // 0..1
  method: string; // e.g. 'llm', 'rule-based'
  reasoning: string;
  llmModelUsed: string;
  error?: string;
};

// Zod schema for validating LLM response
export const LLMResponseSchema = z.object({
  predictedEthnicity: z.string(),
  confidence: z.number().min(0).max(1),
  method: z.string(),
  reasoning: z.string(),
  llmModelUsed: z.string(),
  error: z.string().optional(),
});

// Type for parsed and validated LLM response
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * Extracts JSON from LLM response text, handling markdown code blocks and plain JSON.
 * @param text LLM output string
 * @returns Parsed object or throws error
 */
export function extractJsonFromLLMResponse(text: string): any {
  if (typeof text !== 'string') throw new Error('LLM response is not a string');

  // Try to extract JSON inside triple-backtick code block (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  let jsonString = text;
  if (codeBlockMatch && typeof codeBlockMatch[1] === 'string') {
    jsonString = codeBlockMatch[1];
  } else {
    const curlyMatch = text.match(/({[\s\S]*})/);
    if (curlyMatch && typeof curlyMatch[1] === 'string') {
      jsonString = curlyMatch[1];
    } else {
      throw new Error('No JSON object found in LLM response');
    }
  }
  // Attempt to parse
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Failed to parse JSON from LLM response: ' + (err as Error).message);
  }
}


/**
 * Validates extracted LLM response using Zod schema
 * @param obj Extracted object
 * @returns { success: boolean, data?: LLMResponse, error?: string }
 */
export function validateLLMResponse(obj: any): { success: boolean; data?: LLMResponse; error?: string } {
  const result = LLMResponseSchema.safeParse(obj);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error.message };
  }
}

/**
 * Parses an LLM response (string or object) and returns a ClassificationResult or null.
 * Handles extraction, validation, mapping, and error cases.
 *
 * @param response LLM response (string or object)
 * @returns ClassificationResult if valid, or null if invalid/uncertain
 */
export function parseLLMResponse(response: unknown): ClassificationResult | null {
  let extracted: any;
  try {
    // If already an object, use as-is. If string, extract JSON.
    if (typeof response === 'object' && response !== null) {
      extracted = response;
    } else if (typeof response === 'string') {
      extracted = extractJsonFromLLMResponse(response);
    } else {
      throw new Error('Response must be string or object');
    }
  } catch (err) {
    // Extraction failed
    console.error('[LLM Parser] Extraction error:', err);
    return {
      predictedEthnicity: 'Uncertain',
      confidence: 0,
      method: 'llm',
      reasoning: 'Failed to extract JSON from LLM response',
      llmModelUsed: '',
      error: (err as Error).message,
    };
  }

  // Validate
  const validation = validateLLMResponse(extracted);
  if (!validation.success) {
    console.error('[LLM Parser] Validation error:', validation.error);
    return {
      predictedEthnicity: 'Uncertain',
      confidence: 0,
      method: 'llm',
      reasoning: 'Failed to validate LLM response',
      llmModelUsed: extracted?.llmModelUsed || '',
      error: validation.error,
    };
  }

  // Map to ClassificationResult (guaranteed valid by schema)
  const result = validation.data!;
  return {
    predictedEthnicity: result.predictedEthnicity,
    confidence: result.confidence,
    method: result.method,
    reasoning: result.reasoning,
    llmModelUsed: result.llmModelUsed,
    error: result.error,
  };
}

