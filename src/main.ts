import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ConfigSchema } from "./schemas";
import { processCsvPipeline } from "./csv-processor";
import { classifyByNameRules } from "./rule-classifier";
import { classifyNameWithLLM } from "./llm-client";
import path from "path";

// Load environment variables
dotenv.config();

// CLI argument parsing
const argv = yargs(hideBin(process.argv))
    .option("input", {
        alias: "i",
        type: "string",
        describe: "Path to input CSV file",
        demandOption: true,
    })
    .option("output", {
        alias: "o",
        type: "string",
        describe: "Path to output CSV file",
        demandOption: true,
    })
    .option("batchSize", {
        alias: "b",
        type: "number",
        describe: "Batch size for processing",
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
        console.error("Invalid configuration:", err.errors || err.message);
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
    function getBatchSize(): number {
        if (typeof argv.batchSize === "number" && !isNaN(argv.batchSize)) {
            return argv.batchSize;
        }
        if (process.env.BATCH_SIZE && !isNaN(Number(process.env.BATCH_SIZE))) {
            return Number(process.env.BATCH_SIZE);
        }
        return 100;
    }

    const batchSize = getBatchSize();

    let processed = 0;
    let totalRows = await estimateTotalRows(inputFile);
    let startTime = Date.now();
    let interrupted = false;

    function printProgress() {
        const elapsed = (Date.now() - startTime) / 1000;
        const percent =
            totalRows > 0 ? ((processed / totalRows) * 100).toFixed(1) : "N/A";
        process.stdout.write(
            `\rProcessed: ${processed} / ${totalRows} rows (${percent}%) | Elapsed: ${elapsed.toFixed(
                1
            )}s`
        );
    }

    function printSummary() {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = elapsed > 0 ? (processed / elapsed).toFixed(2) : "N/A";
        console.log(`\n--- Summary ---`);
        console.log(`Processed: ${processed} rows`);
        console.log(`Elapsed: ${elapsed.toFixed(1)}s`);
        console.log(`Rate: ${rate} rows/sec`);
        if (interrupted) console.log("Exited by user (SIGINT/SIGTERM).");
    }

    async function shutdownHandler() {
        interrupted = true;
        printSummary();
        process.exit(0);
    }

    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);

    try {
        await processCsvPipeline({
            inputFile,
            outputFile,
            batchSize,
            // Batch transformFn: processes a batch of rows at once
            transformFn: undefined, // will override below
            onProgress: (count) => {
                processed = count;
                printProgress();
            },
            // --- Custom batch transform logic ---
            async batchTransformFn(batch) {
                const apiKey = process.env.OPENROUTER_API_KEY || "";
                const model = process.env.MODEL_NAME || "openai/gpt-4.1-nano";
                // 1. Apply rule-based classifier
                const results: any[] = [];
                const toLLM: { row: any; idx: number }[] = [];
                batch.forEach((row, idx) => {
                    const ruleResult = classifyByNameRules(row.fullName);
                    if (ruleResult && ruleResult.confidence >= 0.85) {
                        results[idx] = {
                            ...row,
                            inferredRace:
                                ruleResult.predictedEthnicity as typeof import("./schemas").EthnicityEnumSchema._type,
                        };
                    } else {
                        toLLM.push({ row, idx });
                    }
                });
                // Logging: batch info
                console.log(`\n[Batch] Processing batch of ${batch.length} rows (${toLLM.length} to LLM, ${batch.length - toLLM.length} by rules)`);
                if (toLLM.length > 0) {
                    const names = toLLM.map(({ row }) => row.fullName);
                    console.log(`[LLM] Sending ${names.length} names to LLM:`, names);
                    const start = Date.now();
                    const llmResults = await (
                        await import("./llm-client")
                    ).classifyNamesWithLLMBatch(names, model, apiKey);
                    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
                    console.log(`[LLM] LLM batch result received in ${elapsed}s`);
                    if (Array.isArray(llmResults)) {
                        toLLM.forEach(({ row, idx }, i) => {
                            const llm = llmResults[i];
                            results[idx] = {
                                ...row,
                                inferredRace:
                                    llm &&
                                    typeof llm.predictedEthnicity === "string"
                                        ? (llm.predictedEthnicity as typeof import("./schemas").EthnicityEnumSchema._type)
                                        : "Uncertain",
                            };
                        });
                    } else {
                        // LLM batch error: mark all as Uncertain
                        console.warn(`[LLM] LLM batch error:`, llmResults.error || llmResults);
                        toLLM.forEach(({ row, idx }) => {
                            results[idx] = {
                                ...row,
                                inferredRace:
                                    "Uncertain" as typeof import("./schemas").EthnicityEnumSchema._type,
                            };
                        });
                    }
                } else {
                    console.log(`[Batch] All rows classified by rules, no LLM call needed.`);
                }
                // Return in original order
                return results;
            },
        });
        printSummary();
    } catch (err: any) {
        console.error("\nProcessing failed:", err.message || err);
        printSummary();
        process.exit(1);
    }
}

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nInterrupted. Exiting gracefully.");
    process.exit(0);
});

main();
