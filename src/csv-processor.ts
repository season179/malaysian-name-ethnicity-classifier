import { InputCsvRowSchema, OutputCsvRowSchema } from './schemas';
import { z } from 'zod';

/**
 * Reads a CSV file as a stream, validates each row, and yields validated rows.
 * Uses Bun's file streaming capabilities for memory efficiency.
 * @param filePath Path to the CSV file
 * @returns Async generator yielding validated rows
 */
export async function* readCsvStream(filePath: string): AsyncGenerator<z.infer<typeof InputCsvRowSchema>> {
  const file = Bun.file(filePath);
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await file.stream();
  } catch (err: any) {
    throw new Error(`Failed to open file: ${filePath} - ${err.message}`);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let headers: string[] | null = null;
  let rowNum = 0;

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      // Only set headers if not already set and line is not empty
      if (!headers && line.trim()) {
        headers = line.split(',').map(h => h.trim());
        continue;
      }
      if (!headers) continue; // skip blank lines before header
      rowNum++;
      const values = line.split(',');
      if (values.length !== headers.length) {
        console.warn(`Skipping malformed row ${rowNum}: column count mismatch.`);
        continue;
      }
      const rowObj = Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim()]));
      try {
        const validated = InputCsvRowSchema.parse(rowObj);
        yield validated;
      } catch (err) {
        console.warn(`Row ${rowNum} failed validation: ${(err as Error).message}`);
        continue;
      }
    }
  }
  // Handle any remaining buffer
  if (buffer && headers) {
    const values = buffer.split(',');
    if (values.length === headers.length) {
      const rowObj = Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim()]));
      try {
        const validated = InputCsvRowSchema.parse(rowObj);
        yield validated;
      } catch (err) {
        console.warn(`Final row failed validation: ${(err as Error).message}`);
      }
    }
  }
}

/**
 * Processes CSV rows in batches, applies transformation, and reports progress.
 * @param inputFile Path to the input CSV file
 * @param batchSize Number of records per batch
 * @param transformFn Function to transform InputCsvRow to OutputCsvRow
 * @param onProgress Optional callback for progress reporting
 */

type InputCsvRow = z.infer<typeof InputCsvRowSchema>;
type OutputCsvRow = z.infer<typeof OutputCsvRowSchema>;

export async function processCsvInBatches({
  inputFile,
  batchSize = 100,
  transformFn,
  onProgress,
}: {
  inputFile: string;
  batchSize?: number;
  transformFn: (row: InputCsvRow) => OutputCsvRow | Promise<OutputCsvRow>;
  onProgress?: (processed: number, total?: number) => void;
}): Promise<void> {
  let batch: InputCsvRow[] = [];
  let processed = 0;
  let total: number | undefined = undefined; // Not known unless file is pre-counted

  try {
    for await (const row of readCsvStream(inputFile)) {
      batch.push(row);
      if (batch.length >= batchSize) {
        await processBatch(batch, transformFn);
        processed += batch.length;
        if (onProgress) onProgress(processed, total);
        batch = [];
      }
    }
    // Process any remaining rows
    if (batch.length > 0) {
      await processBatch(batch, transformFn);
      processed += batch.length;
      if (onProgress) onProgress(processed, total);
    }
    console.info(`CSV processing completed. Total records processed: ${processed}`);
  } catch (err) {
    console.error('Error during batch processing:', err);
    throw err;
  }
}

/**
 * Processes a batch of rows, applying the transformation and validating output.
 */
async function processBatch(
  rows: InputCsvRow[],
  transformFn: (row: InputCsvRow) => OutputCsvRow | Promise<OutputCsvRow>
): Promise<void> {
  for (const row of rows) {
    try {
      const output = await transformFn(row);
      OutputCsvRowSchema.parse(output); // Validate output
      // Here you would collect or write output rows (to be integrated with writer)
    } catch (err) {
      console.warn('Batch row failed transformation or validation:', err);
      // Optionally log or collect errors
    }
  }
}

/**
 * Writes rows to a CSV file, handling headers and streaming output.
 * @param outputFile Path to the output CSV file
 * @param rows Async iterable of OutputCsvRow
 */
export async function writeCsvStream(outputFile: string, rows: AsyncIterable<OutputCsvRow>) {
  const headers = Object.keys(OutputCsvRowSchema.shape);
  let output = headers.join(',') + '\n';
  for await (const row of rows) {
    const line = headers.map(h => (row as any)[h] ?? '').join(',');
    output += line + '\n';
  }
  await Bun.write(outputFile, output);
}

/**
 * Full pipeline: reads input CSV, processes in batches, and writes output CSV.
 * @param inputFile Path to input CSV
 * @param outputFile Path to output CSV
 * @param batchSize Number of records per batch
 * @param transformFn Transformation function
 * @param onProgress Progress callback
 */
export async function processCsvPipeline({
  inputFile,
  outputFile,
  batchSize = 100,
  transformFn,
  onProgress,
}: {
  inputFile: string;
  outputFile: string;
  batchSize?: number;
  transformFn: (row: InputCsvRow) => OutputCsvRow | Promise<OutputCsvRow>;
  onProgress?: (processed: number, total?: number) => void;
}) {
  const outputRows: AsyncGenerator<OutputCsvRow> = (async function* () {
    let batch: InputCsvRow[] = [];
    let processed = 0;
    for await (const row of readCsvStream(inputFile)) {
      batch.push(row);
      if (batch.length >= batchSize) {
        for (const output of await transformAndValidateBatch(batch, transformFn)) {
          yield output;
        }
        processed += batch.length;
        if (onProgress) onProgress(processed);
        batch = [];
      }
    }
    if (batch.length > 0) {
      for (const output of await transformAndValidateBatch(batch, transformFn)) {
        yield output;
      }
      processed += batch.length;
      if (onProgress) onProgress(processed);
    }
  })();
  await writeCsvStream(outputFile, outputRows);
}

async function transformAndValidateBatch(
  rows: InputCsvRow[],
  transformFn: (row: InputCsvRow) => OutputCsvRow | Promise<OutputCsvRow>
): Promise<OutputCsvRow[]> {
  const outputs: OutputCsvRow[] = [];
  for (const row of rows) {
    try {
      const output = await transformFn(row);
      OutputCsvRowSchema.parse(output);
      outputs.push(output);
    } catch (err) {
      console.warn('Batch row failed transformation or validation:', err);
    }
  }
  return outputs;
}

// Example usage:
// await processCsvPipeline({
//   inputFile: 'input.csv',
//   outputFile: 'output.csv',
//   batchSize: 100,
//   transformFn: (row) => ({ ...row, inferredRace: 'Uncertain' }),
//   onProgress: (processed) => console.log(`Processed: ${processed}`)
// });
