import { classifyByNameRules, sanitizeName } from './rule-classifier';
import type { ClassificationResult } from './llm-parser';

/**
 * Main orchestrator for Malaysian name ethnicity classification.
 * First tries rule-based, then (in later subtasks) will fall back to LLM.
 */
import { classifyNameWithLLM } from './llm-client';
import { parseLLMResponse } from './llm-parser';

/**
 * Main orchestrator for Malaysian name ethnicity classification.
 * Tries rule-based, then falls back to LLM if needed.
 * @param fullName Malaysian full name
 * @param opts Optional: { apiKey, model } for LLM
 */
type CacheKey = string;
type CacheValue = ClassificationResult;
const classificationCache = new Map<CacheKey, CacheValue>();

export async function classifyMalaysianName(
  fullName: string,
  opts?: { apiKey?: string; model?: string; bypassCache?: boolean }
): Promise<ClassificationResult> {
  const start = Date.now();
  try {
    // 1. Sanitize input
    const cleanName = sanitizeName(fullName);
    const cacheKey = `${cleanName.toLowerCase()}|${opts?.model || ''}`;
    const useCache = !opts?.bypassCache;

    // 2. Check cache
    if (useCache && classificationCache.has(cacheKey)) {
      const cached = classificationCache.get(cacheKey)!;
      console.log('[Classifier] Cache hit:', { name: cleanName, method: cached.method, confidence: cached.confidence });
      return cached;
    }
    if (useCache) {
      console.log('[Classifier] Cache miss:', { name: cleanName });
    }

    // 3. Rule-based classification
    const ruleResult = classifyByNameRules(cleanName);
    if (ruleResult && ruleResult.confidence >= 0.85) {
      const safeResult = { ...ruleResult, llmModelUsed: ruleResult.llmModelUsed || '' };
      classificationCache.set(cacheKey, safeResult);
      console.log('[Classifier] Rule-based result:', { name: cleanName, method: safeResult.method, confidence: safeResult.confidence });
      return safeResult;
    }

    // 4. LLM fallback
    if (!opts?.apiKey || !opts?.model) {
      // LLM not configured, return uncertain
      const result = {
        predictedEthnicity: 'Uncertain',
        confidence: 0,
        method: 'rule-based',
        reasoning: 'Rule-based classifier could not determine ethnicity and LLM API is not configured',
        llmModelUsed: '',
        error: 'No LLM API key/model provided',
      };
      classificationCache.set(cacheKey, result);
      console.log('[Classifier] LLM not configured:', { name: cleanName });
      return result;
    }
    let llmRawResult;
    try {
      llmRawResult = await classifyNameWithLLM(cleanName, opts.model, opts.apiKey);
    } catch (llmErr) {
      const result = {
        predictedEthnicity: 'Uncertain',
        confidence: 0,
        method: 'llm',
        reasoning: 'LLM API call failed',
        llmModelUsed: opts.model,
        error: (llmErr as Error).message,
      };
      classificationCache.set(cacheKey, result);
      console.log('[Classifier] LLM API error:', { name: cleanName, error: result.error });
      return result;
    }
    // Parse/validate LLM response
    const llmParsed = parseLLMResponse(llmRawResult);
    if (!llmParsed || llmParsed.predictedEthnicity === 'Uncertain') {
      const result = {
        predictedEthnicity: 'Uncertain',
        confidence: 0,
        method: 'llm',
        reasoning: 'LLM could not determine ethnicity',
        llmModelUsed: opts.model || '',
        error: llmParsed?.error || 'LLM returned uncertain or invalid result',
      };
      classificationCache.set(cacheKey, result);
      console.log('[Classifier] LLM uncertain/invalid:', { name: cleanName, error: result.error });
      return result;
    }
    // Cache and log final LLM result
    const safeLLM = { ...llmParsed, llmModelUsed: llmParsed.llmModelUsed || opts.model || '' };
    classificationCache.set(cacheKey, safeLLM);
    console.log('[Classifier] LLM result:', { name: cleanName, method: safeLLM.method, confidence: safeLLM.confidence });
    return safeLLM;
  } catch (err) {
    // Always return a valid result on error
    const result = {
      predictedEthnicity: 'Uncertain',
      confidence: 0,
      method: 'orchestrator',
      reasoning: 'Error during classification: ' + (err as Error).message,
      llmModelUsed: '',
      error: (err as Error).message,
    };
    console.log('[Classifier] Error:', { name: fullName, error: result.error });
    return result;
  } finally {
    const ms = Date.now() - start;
    console.log('[Classifier] Processing time (ms):', ms, { name: fullName });
  }
}


// Export ClassificationResult type for convenience
export type { ClassificationResult } from './llm-parser';
