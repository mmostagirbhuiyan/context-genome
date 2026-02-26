#!/usr/bin/env node

import { resolve, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  discoverContextFiles,
  concatenateContext,
  summarizeDiscovery,
} from "./discover.js";
import { generateGenome, editGenome } from "./generate.js";
import { createMeta, writeMeta, readMeta } from "./meta.js";

const CLAUDE_MD = "CLAUDE.md";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  switch (command) {
    case "init":
      await init(args.slice(1));
      break;
    case "update":
      await update(args.slice(1));
      break;
    case "status":
      await status(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

async function init(args: string[]): Promise<void> {
  const { repoPath, edit, output } = parseArgs(args);

  console.log(`Scanning ${repoPath} for context files...\n`);

  const files = await discoverContextFiles(repoPath);
  if (files.length === 0) {
    console.error(
      "No context files found. Expected CLAUDE.md, README.md, package.json, etc.",
    );
    process.exit(1);
  }
  console.log(summarizeDiscovery(files));

  // Check for existing genome
  const meta = await readMeta(repoPath);
  if (meta) {
    console.log(
      `\nExisting genome found (v${meta.version}, generated ${meta.generatedAt}).`,
    );
    console.log(
      "Use 'genome update' to regenerate, or delete .genome.meta to reinitialize.",
    );
    process.exit(1);
  }

  const context = concatenateContext(files);

  console.log("\nGenerating genome...");
  let genome = await generateGenome(context);

  let edited = false;
  if (edit) {
    console.log("Running edit pass...");
    genome = await editGenome(genome, context);
    edited = true;
  }

  // Write genome as CLAUDE.md
  const outputPath = join(repoPath, output);
  await writeFile(outputPath, genome + "\n");
  console.log(`Wrote genome to ${output}`);

  // Write meta sidecar
  const genomeMeta = createMeta({
    provider: "anthropic-api",
    edited,
    sourceFiles: files.map((f) => f.relativePath),
    genomeContent: genome,
  });
  await writeMeta(repoPath, genomeMeta);
  console.log("Wrote metadata to .genome.meta");
  console.log(
    `\nGenome: ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum}`,
  );
}

async function update(args: string[]): Promise<void> {
  const { repoPath, edit, output } = parseArgs(args);

  const existingMeta = await readMeta(repoPath);
  if (!existingMeta) {
    console.error("No .genome.meta found. Run 'genome init' first.");
    process.exit(1);
  }

  console.log(
    `Updating genome (v${existingMeta.version}) in ${repoPath}...\n`,
  );

  const files = await discoverContextFiles(repoPath);
  if (files.length === 0) {
    console.error("No context files found.");
    process.exit(1);
  }
  console.log(summarizeDiscovery(files));

  const context = concatenateContext(files);

  console.log("\nRegenerating genome...");
  let genome = await generateGenome(context);

  let edited = false;
  if (edit) {
    console.log("Running edit pass...");
    genome = await editGenome(genome, context);
    edited = true;
  }

  const outputPath = join(repoPath, output);
  await writeFile(outputPath, genome + "\n");
  console.log(`Wrote updated genome to ${output}`);

  const genomeMeta = createMeta({
    provider: "anthropic-api",
    edited,
    sourceFiles: files.map((f) => f.relativePath),
    genomeContent: genome,
  });
  genomeMeta.version = existingMeta.version + 1;
  await writeMeta(repoPath, genomeMeta);
  console.log(`Updated .genome.meta (v${genomeMeta.version})`);
  console.log(
    `\nGenome: ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum}`,
  );
}

async function status(args: string[]): Promise<void> {
  const repoPath = resolve(args[0] || ".");

  const meta = await readMeta(repoPath);
  if (!meta) {
    console.log("No genome found. Run 'genome init' to create one.");
    return;
  }

  const claudeMdPath = join(repoPath, CLAUDE_MD);
  let currentChecksum = "";
  try {
    const content = await readFile(claudeMdPath, "utf-8");
    const { createHash } = await import("node:crypto");
    currentChecksum = createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 16);
  } catch {
    // CLAUDE.md not found
  }

  const modified = currentChecksum && currentChecksum !== meta.checksum;

  console.log(`Genome v${meta.version}`);
  console.log(`  Generated: ${meta.generatedAt}`);
  console.log(
    `  Provider:  ${meta.provider}${meta.edited ? " (with edit pass)" : ""}`,
  );
  console.log(`  Tokens:    ~${meta.tokenEstimate}`);
  console.log(`  Sources:   ${meta.sourceFiles.join(", ")}`);
  console.log(
    `  Checksum:  ${meta.checksum}${modified ? " (MODIFIED)" : ""}`,
  );
}

function parseArgs(args: string[]): {
  repoPath: string;
  edit: boolean;
  output: string;
} {
  let repoPath = ".";
  let edit = false;
  let output = CLAUDE_MD;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--edit" || arg === "-e") {
      edit = true;
    } else if (arg === "--output" || arg === "-o") {
      output = args[++i];
    } else if (!arg.startsWith("-")) {
      repoPath = arg;
    }
  }

  return { repoPath: resolve(repoPath), edit, output };
}

function printUsage(): void {
  console.log(`context-genome - Compress project context for LLM agents

Usage:
  genome init [path] [options]     Generate genome from project context files
  genome update [path] [options]   Regenerate genome from updated context
  genome status [path]             Show genome metadata and status

Options:
  -e, --edit              Run a refinement pass after generation
  -o, --output <file>     Output file (default: CLAUDE.md)
  -h, --help              Show this help

Environment:
  ANTHROPIC_API_KEY       Required. Get one at https://console.anthropic.com

Examples:
  genome init                      # Generate genome for current directory
  genome init ../my-project        # Generate for another project
  genome init --edit               # Generate with refinement pass
  genome update                    # Regenerate from updated sources
  genome status                    # Check genome version and metadata`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
