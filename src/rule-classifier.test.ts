import { expect, test } from 'bun:test';
import { sanitizeName, classifyByNameRules } from './rule-classifier';

// --- Tests for sanitizeName ---
test('sanitizeName trims, lowercases, and normalizes spaces', () => {
  expect(sanitizeName('  MOHAMAD SYED BIN CHE\'GOOS  ')).toBe("mohamad syed bin che'goos");
  expect(sanitizeName('  John   Doe  ')).toBe('john doe');
  expect(sanitizeName('Mary-Jane O\'Connor')).toBe("mary-jane o'connor");
});

test('sanitizeName removes special characters except hyphens and apostrophes', () => {
  expect(sanitizeName('Ali@#$%^&*()_+=|?><.,:;"[]{}')).toBe('ali');
  expect(sanitizeName("NIK!@# BINTI$%^&*()" )).toBe('nik binti');
});

// --- Tests for classifyByNameRules ethnicity detection ---
test('classifyByNameRules detects Malay by patronymic', () => {
  const res = classifyByNameRules("MOHAMAD SYED BIN CHE'GOOS");
  expect(res).not.toBeNull();
  expect(res?.predictedEthnicity).toBe('Malay');
  expect(res?.confidence).toBeGreaterThanOrEqual(0.9);
});

test('classifyByNameRules detects Malay by prefix', () => {
  const res = classifyByNameRules('Tengku Ahmad Faizal');
  expect(res).not.toBeNull();
  expect(res?.predictedEthnicity).toBe('Malay');
});

test('classifyByNameRules detects Indian by patronymic', () => {
  const res = classifyByNameRules('Arumugam a/l Maniam');
  expect(res).not.toBeNull();
  expect(res?.predictedEthnicity).toBe('Indian');
});

test('classifyByNameRules detects Indian by common name', () => {
  const res = classifyByNameRules('Selvam Raj Kumar');
  expect(res).not.toBeNull();
  expect(res?.predictedEthnicity).toBe('Indian');
});

test('classifyByNameRules detects Chinese by surname', () => {
  const res = classifyByNameRules('Tan Ah Kow');
  expect(res).not.toBeNull();
  expect(res?.predictedEthnicity).toBe('Chinese');
});

test('classifyByNameRules returns null for ambiguous/unknown names', () => {
  expect(classifyByNameRules('John Smith')).toBeNull();
  expect(classifyByNameRules('Aisyah Lee')).toBeNull(); // Mixed name
});

