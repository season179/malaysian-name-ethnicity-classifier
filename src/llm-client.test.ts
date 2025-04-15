import { expect, test } from 'bun:test';
import { classifyNameWithLLM, type LLMClassificationResult, type LLMClientError } from './llm-client';

// Mock fetch for unit testing
const originalFetch = globalThis.fetch;

test('classifyNameWithLLM returns classification result on valid response', async () => {
  globalThis.fetch = Object.assign(
    async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                predictedEthnicity: 'Malay',
                confidence: 0.92,
                method: 'llm',
                reasoning: 'Contains bin',
                llmModelUsed: 'gpt-4',
              }),
            },
          },
        ],
      }),
    }),
    originalFetch
  ) as typeof fetch;

  const result = await classifyNameWithLLM('Ahmad bin Ali', 'gpt-4', 'fake-key', { maxRetries: 0 });
  expect((result as LLMClassificationResult).predictedEthnicity).toBe('Malay');
  expect((result as LLMClassificationResult).confidence).toBeGreaterThan(0.8);
});

test('classifyNameWithLLM returns error on malformed LLM JSON', async () => {
  globalThis.fetch = Object.assign(
    async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: { content: '{not a valid json}' },
          },
        ],
      }),
    }),
    originalFetch
  ) as typeof fetch;

  const result = await classifyNameWithLLM('Ahmad bin Ali', 'gpt-4', 'fake-key', { maxRetries: 1, retryDelayMs: 10 });
  expect((result as LLMClientError).error).toContain('Failed to parse LLM JSON output');
});

test('classifyNameWithLLM returns error on API error', async () => {
  globalThis.fetch = Object.assign(
    async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit',
    }),
    originalFetch
  ) as typeof fetch;

  const result = await classifyNameWithLLM('Ahmad bin Ali', 'gpt-4', 'fake-key', { maxRetries: 1, retryDelayMs: 10 });
  expect((result as LLMClientError).error).toContain('OpenRouter API error');
});

test('classifyNameWithLLM returns error on malformed OpenRouter response', async () => {
  globalThis.fetch = Object.assign(
    async () => ({
      ok: true,
      text: async () => '{not valid json}',
    }),
    originalFetch
  ) as typeof fetch;

  const result = await classifyNameWithLLM('Ahmad bin Ali', 'gpt-4', 'fake-key', { maxRetries: 0 });
  expect((result as LLMClientError).error).toContain('Failed to parse OpenRouter response as JSON');
});

test('classifyNameWithLLM returns error on missing content', async () => {
  globalThis.fetch = Object.assign(
    async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{}] }),
    }),
    originalFetch
  ) as typeof fetch;

  const result = await classifyNameWithLLM('Ahmad bin Ali', 'gpt-4', 'fake-key', { maxRetries: 0 });
  expect((result as LLMClientError).error).toContain('No content found');
});

// Restore original fetch after tests
// (Bun runs tests in a single process, so this is important)
test('restore fetch', () => {
  globalThis.fetch = originalFetch;
});
