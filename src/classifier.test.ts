import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classifyMalaysianName } from './classifier';
import * as ruleClassifier from './rule-classifier';
import * as llmClient from './llm-client';

// Helper: reset cache by re-importing the module (if needed)
// (Not strictly necessary for Bun if cache is module-local and tests are independent)

describe('classifyMalaysianName', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns high-confidence rule-based result when available', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue({
      predictedEthnicity: 'Malay',
      confidence: 0.95,
      method: 'rule-based',
      reasoning: 'Starts with bin',
      llmModelUsed: '',
    });
    const result = await classifyMalaysianName('Ahmad bin Ali');
    expect(result.predictedEthnicity).toBe('Malay');
    expect(result.method).toBe('rule-based');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('falls back to LLM when rule-based is inconclusive', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue(null);
    vi.spyOn(llmClient, 'classifyNameWithLLM').mockResolvedValue({
      predictedEthnicity: 'Chinese',
      confidence: 0.92,
      method: 'llm',
      reasoning: 'Surname matches Chinese pattern',
      llmModelUsed: 'gpt-4',
    });
    // Patch parseLLMResponse to identity for this test (simulate valid LLM result)
    const { parseLLMResponse } = await import('./llm-parser');
    vi.spyOn(await import('./llm-parser'), 'parseLLMResponse').mockImplementation((resp) => resp as import('./llm-parser').ClassificationResult);
    const result = await classifyMalaysianName('Lim Wei Ming', { apiKey: 'test', model: 'gpt-4' });
    expect(result.predictedEthnicity).toBe('Chinese');
    expect(result.method).toBe('llm');
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it('returns uncertain if both rule-based and LLM fail', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue(null);
    vi.spyOn(llmClient, 'classifyNameWithLLM').mockResolvedValue({
      predictedEthnicity: 'Uncertain',
      confidence: 0,
      method: 'llm',
      reasoning: 'Not enough info',
      llmModelUsed: 'gpt-4',
      error: 'Uncertain',
    });
    const { parseLLMResponse } = await import('./llm-parser');
    vi.spyOn(await import('./llm-parser'), 'parseLLMResponse').mockImplementation((resp) => resp as import('./llm-parser').ClassificationResult);
    const result = await classifyMalaysianName('Unknown Name', { apiKey: 'test', model: 'gpt-4' });
    expect(result.predictedEthnicity).toBe('Uncertain');
    expect(result.method).toBe('llm');
  });

  it('uses cache for repeated calls with same name/model', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValueOnce(null);
    const llmSpy = vi.spyOn(llmClient, 'classifyNameWithLLM').mockResolvedValue({
      predictedEthnicity: 'Indian',
      confidence: 0.9,
      method: 'llm',
      reasoning: 'Pattern matches Indian',
      llmModelUsed: 'gpt-4',
    });
    const { parseLLMResponse } = await import('./llm-parser');
    vi.spyOn(await import('./llm-parser'), 'parseLLMResponse').mockImplementation((resp) => resp as import('./llm-parser').ClassificationResult);
    const opts = { apiKey: 'test', model: 'gpt-4' };
    const first = await classifyMalaysianName('Raj Kumar', opts);
    const second = await classifyMalaysianName('Raj Kumar', opts);
    expect(first.predictedEthnicity).toBe('Indian');
    expect(second.predictedEthnicity).toBe('Indian');
    expect(llmSpy).toHaveBeenCalledTimes(1); // Only called once due to cache
  });

  it('bypasses cache if bypassCache=true', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue(null);
    const llmSpy = vi.spyOn(llmClient, 'classifyNameWithLLM').mockResolvedValue({
      predictedEthnicity: 'Indian',
      confidence: 0.9,
      method: 'llm',
      reasoning: 'Pattern matches Indian',
      llmModelUsed: 'gpt-4',
    });
    const { parseLLMResponse } = await import('./llm-parser');
    vi.spyOn(await import('./llm-parser'), 'parseLLMResponse').mockImplementation((resp) => resp as import('./llm-parser').ClassificationResult);
    const opts = { apiKey: 'test', model: 'gpt-4', bypassCache: true };
    await classifyMalaysianName('Raj Kumar', opts);
    await classifyMalaysianName('Raj Kumar', opts);
    expect(llmSpy).toHaveBeenCalledTimes(2); // Called twice since cache bypassed
  });

  it('returns uncertain if LLM API key/model missing', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue(null);
    const result = await classifyMalaysianName('Foo Bar');
    expect(result.predictedEthnicity).toBe('Uncertain');
    expect(result.error).toMatch(/No LLM API key/);
  });

  it('returns uncertain if LLM throws error', async () => {
    vi.spyOn(ruleClassifier, 'sanitizeName').mockImplementation((n) => n.trim());
    vi.spyOn(ruleClassifier, 'classifyByNameRules').mockReturnValue(null);
    vi.spyOn(llmClient, 'classifyNameWithLLM').mockRejectedValue(new Error('LLM network error'));
    const { parseLLMResponse } = await import('./llm-parser');
    vi.spyOn(await import('./llm-parser'), 'parseLLMResponse').mockImplementation((resp) => resp as import('./llm-parser').ClassificationResult);
    const result = await classifyMalaysianName('Foo Bar', { apiKey: 'test', model: 'gpt-4' });
    expect(result.predictedEthnicity).toBe('Uncertain');
    expect(result.error).toMatch(/LLM network error/);
  });
});
