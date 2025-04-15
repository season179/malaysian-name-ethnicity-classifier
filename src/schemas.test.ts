import { EthnicityEnumSchema, InputCsvRowSchema, ClassificationResultSchema, OutputCsvRowSchema, ConfigSchema } from './schemas';
import { expect, test } from 'bun:test';

// Sample valid input row
const validInput = {
  employeeId: '88928249',
  fullName: "MOHAMAD SYED BIN CHE'GOOS",
  mobileNumber: '60128729024',
  idType: 'mykad',
  idNumber: '790409-02-5308',
  role: 'Non-executive/Staff',
  salary: 2531,
  bankName: 'MBBB',
  accountNumber: '186026040269',
};

// Sample valid classification result
const validResult = {
  predictedEthnicity: 'Malay',
  confidence: 0.95,
  method: 'rule-based',
  reasoning: 'Name pattern matches Malay conventions',
  llmModelUsed: 'gpt-3.5-turbo',
};

test('EthnicityEnumSchema accepts valid ethnicities', () => {
  expect(EthnicityEnumSchema.parse('Malay')).toBe('Malay');
  expect(EthnicityEnumSchema.parse('Chinese')).toBe('Chinese');
  expect(EthnicityEnumSchema.parse('Indian')).toBe('Indian');
  expect(EthnicityEnumSchema.parse('Others')).toBe('Others');
  expect(EthnicityEnumSchema.parse('Uncertain')).toBe('Uncertain');
});

test('EthnicityEnumSchema rejects invalid ethnicity', () => {
  expect(() => EthnicityEnumSchema.parse('Alien')).toThrow();
});

test('InputCsvRowSchema validates a correct input row', () => {
  expect(InputCsvRowSchema.parse(validInput)).toBeTruthy();
});

test('InputCsvRowSchema rejects missing required fields', () => {
  const { fullName, ...incomplete } = validInput;
  expect(() => InputCsvRowSchema.parse(incomplete)).toThrow();
});

test('InputCsvRowSchema coerces string salary to number', () => {
  const input = { ...validInput, salary: '2531' };
  expect(InputCsvRowSchema.parse(input).salary).toBe(2531);
});

test('ClassificationResultSchema validates a correct result', () => {
  expect(ClassificationResultSchema.parse(validResult)).toBeTruthy();
});

test('ClassificationResultSchema rejects confidence > 1', () => {
  expect(() => ClassificationResultSchema.parse({ ...validResult, confidence: 1.1 })).toThrow();
});

test('ClassificationResultSchema rejects confidence < 0', () => {
  expect(() => ClassificationResultSchema.parse({ ...validResult, confidence: -0.1 })).toThrow();
});

test('ClassificationResultSchema accepts optional error field', () => {
  expect(ClassificationResultSchema.parse({ ...validResult, error: 'Some error' })).toBeTruthy();
});

test('OutputCsvRowSchema validates correct output row', () => {
  const output = { ...validInput, inferredRace: 'Malay' };
  expect(OutputCsvRowSchema.parse(output)).toBeTruthy();
});

test('OutputCsvRowSchema rejects missing inferredRace', () => {
  expect(() => OutputCsvRowSchema.parse(validInput)).toThrow();
});

test('ConfigSchema validates required OPENAI_API_KEY', () => {
  expect(ConfigSchema.parse({ OPENAI_API_KEY: 'sk-xxx', MODEL_NAME: 'gpt-3.5-turbo', CONFIDENCE_THRESHOLD: 0.8 })).toBeTruthy();
});

test('ConfigSchema rejects missing OPENAI_API_KEY', () => {
  expect(() => ConfigSchema.parse({ MODEL_NAME: 'gpt-3.5-turbo' })).toThrow();
});

test('ConfigSchema coerces string CONFIDENCE_THRESHOLD', () => {
  const config = ConfigSchema.parse({ OPENAI_API_KEY: 'sk-xxx', CONFIDENCE_THRESHOLD: '0.8' });
  expect(config.CONFIDENCE_THRESHOLD).toBe(0.8);
});
