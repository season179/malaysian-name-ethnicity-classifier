import { z } from 'zod';

/**
 * Enum schema for supported ethnicities
 */
export const EthnicityEnumSchema = z.enum([
  'Malay',
  'Chinese',
  'Indian',
  'Others',
  'Uncertain',
]);

/**
 * Schema for a row in the input CSV file
 */
export const InputCsvRowSchema = z.object({
  employeeId: z.string().or(z.number()).transform((v) => v.toString()),
  fullName: z.string(),
  mobileNumber: z.string(),
  idType: z.string(),
  idNumber: z.string(),
  role: z.string(),
  salary: z.preprocess((v) => typeof v === 'string' ? parseFloat(v) : v, z.number()),
  bankName: z.string(),
  accountNumber: z.string(),
});

/**
 * Schema for the result of ethnicity classification
 */
export const ClassificationResultSchema = z.object({
  predictedEthnicity: EthnicityEnumSchema,
  confidence: z.number().min(0).max(1),
  method: z.string(),
  reasoning: z.string(),
  llmModelUsed: z.string(),
  error: z.string().optional(),
});

/**
 * Schema for a row in the output CSV file (mirrors input but ensures 'Inferred Race' is present)
 */
export const OutputCsvRowSchema = InputCsvRowSchema.extend({
  inferredRace: EthnicityEnumSchema,
});

/**
 * Schema for runtime configuration loaded from environment variables
 */
export const ConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  MODEL_NAME: z.string().default('openai/gpt-4.1-nano'),
  CONFIDENCE_THRESHOLD: z
    .preprocess((v) => typeof v === 'string' ? parseFloat(v) : v, z.number().min(0).max(1))
    .default(0.7),
  // Add other config variables as needed
});
