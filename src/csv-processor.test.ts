import { describe, it, expect, vi } from 'vitest';
import { readCsvStream, processCsvInBatches, processCsvPipeline } from './csv-processor';
import { EthnicityEnumSchema } from './schemas';

const sampleCsv = `employeeId,fullName,mobileNumber,idType,idNumber,role,salary,bankName,accountNumber\n1,John Doe,0123456789,IC,900101-01-1234,Engineer,5000,Maybank,1234567890\n2,Jane Lee,0198765432,IC,880202-02-5678,Manager,7000,CIMB,9876543210`;
const malformedCsv = `employeeId,fullName,mobileNumber\n1,John Doe\n2,Jane Lee,0198765432,IC,880202-02-5678,Manager,7000,CIMB,9876543210`;

function createTempFile(content: string): string {
  const path = `./tmp_test_${Math.random().toString(36).slice(2)}.csv`;
  Bun.write(path, content);
  return path;
}

describe('csv-processor', () => {
  it('reads and validates CSV rows', async () => {
    const path = createTempFile(sampleCsv);
    const rows = [];
    for await (const row of readCsvStream(path)) {
      rows.push(row);
    }
    expect(rows.length).toBe(2);
    expect(rows[0]!.fullName).toBe('John Doe');
    expect(rows[1]!.salary).toBe(7000);
  });

  it('skips malformed rows and logs warnings', async () => {
    const path = createTempFile(malformedCsv);
    const rows = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for await (const row of readCsvStream(path)) {
      rows.push(row);
    }
    expect(rows.length).toBe(0); // No valid rows due to column mismatch
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('processes CSV in batches and transforms', async () => {
    const path = createTempFile(sampleCsv);
    const processed: any[] = [];
    await processCsvInBatches({
      inputFile: path,
      batchSize: 1,
      transformFn: (row) => ({ ...row, inferredRace: EthnicityEnumSchema.Enum.Chinese }),
      onProgress: (count) => processed.push(count),
    });
    expect(processed).toContain(1);
    expect(processed).toContain(2);
  });

  it('writes output CSV and integrates pipeline', async () => {
    const inPath = createTempFile(sampleCsv);
    const outPath = createTempFile('');
    await processCsvPipeline({
      inputFile: inPath,
      outputFile: outPath,
      batchSize: 1,
      transformFn: (row) => ({ ...row, inferredRace: EthnicityEnumSchema.Enum.Malay }),
      onProgress: () => {},
    });
    const outContent = await Bun.file(outPath).text();
    expect(outContent).toMatch(/inferredRace/);
    expect(outContent).toMatch(/Malay/);
    const nonEmptyLines = outContent.split('\n').filter(line => line.trim().length > 0);
    expect(nonEmptyLines.length).toBe(3); // header + 2 rows
  });
});
