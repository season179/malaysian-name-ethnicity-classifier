import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ConfigSchema } from './schemas';
import { processCsvPipeline } from './csv-processor';
import path from 'path';

// Load environment variables
dotenv.config();

// CLI argument parsing
const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    type: 'string',
    describe: 'Path to input CSV file',
    demandOption: true,
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    describe: 'Path to output CSV file',
    demandOption: true,
  })
  .option('batchSize', {
    alias: 'b',
    type: 'number',
    describe: 'Batch size for processing',
    default: 100,
  })
  .help()
  .parseSync();

// Validate configuration
function validateConfig() {
  try {
    const config = ConfigSchema.parse(process.env);
    return config;
  } catch (err: any) {
    console.error('Invalid configuration:', err.errors || err.message);
    process.exit(1);
  }
}

async function estimateTotalRows(filePath: string): Promise<number> {
  // Estimate total rows by counting lines (excluding header)
  try {
    const text = await Bun.file(filePath).text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    return Math.max(0, lines.length - 1); // subtract header
  } catch (err) {
    return 0;
  }
}

async function main() {
  const config = validateConfig();
  const inputFile = path.resolve(argv.input);
  const outputFile = path.resolve(argv.output);
  const batchSize = argv.batchSize;

  let processed = 0;
  let totalRows = await estimateTotalRows(inputFile);
  let startTime = Date.now();
  let interrupted = false;

  function printProgress() {
    const elapsed = (Date.now() - startTime) / 1000;
    const percent = totalRows > 0 ? ((processed / totalRows) * 100).toFixed(1) : 'N/A';
    process.stdout.write(`\rProcessed: ${processed} / ${totalRows} rows (${percent}%) | Elapsed: ${elapsed.toFixed(1)}s`);
  }

  function printSummary() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = elapsed > 0 ? (processed / elapsed).toFixed(2) : 'N/A';
    console.log(`\n--- Summary ---`);
    console.log(`Processed: ${processed} rows`);
    console.log(`Elapsed: ${elapsed.toFixed(1)}s`);
    console.log(`Rate: ${rate} rows/sec`);
    if (interrupted) console.log('Exited by user (SIGINT/SIGTERM).');
  }

  async function shutdownHandler() {
    interrupted = true;
    printSummary();
    process.exit(0);
  }

  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);

  try {
    await processCsvPipeline({
      inputFile,
      outputFile,
      batchSize,
      transformFn: (row) => ({ ...row, inferredRace: 'Uncertain' }), // Replace with real logic
      onProgress: (count) => {
        processed = count;
        printProgress();
      },
    });
    printSummary();
  } catch (err: any) {
    console.error('\nProcessing failed:', err.message || err);
    printSummary();
    process.exit(1);
  }
}


// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nInterrupted. Exiting gracefully.');
  process.exit(0);
});

main();
