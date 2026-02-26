#!/usr/bin/env node

import { resolve, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  discoverContextFiles,
  concatenateContext,
  summarizeDiscovery,
} from "./discover.js";
import {
  generateGenome,
  editGenome,
  detectProvider,
  type Provider,
} from "./generate.js";
import { createMeta, writeMeta, readMeta } from "./meta.js";
import { diffGenomes, formatDiff, summarizeDiff } from "./diff.js";
import { mergeGenomes } from "./merge.js";

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
    case "diff":
      await diff(args.slice(1));
      break;
    case "merge":
      await merge(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

async function init(args: string[]): Promise<void> {
  const { repoPath, provider, edit, output, dryRun } = parseArgs(args);

  console.log(`Scanning ${repoPath} for context files...\n`);

  const files = await discoverContextFiles(repoPath);
  if (files.length === 0) {
    console.error(
      "No context files found. Expected CLAUDE.md, README.md, package.json, etc.",
    );
    process.exit(1);
  }
  console.log(summarizeDiscovery(files));

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

  const resolvedProvider = await resolveProvider(provider);
  const context = concatenateContext(files);

  console.log(`\nGenerating genome via ${resolvedProvider}...`);
  let genome = await generateGenome(context, resolvedProvider);

  let edited = false;
  if (edit) {
    console.log("Running edit pass...");
    genome = await editGenome(genome, context, resolvedProvider);
    edited = true;
  }

  const genomeMeta = createMeta({
    provider: resolvedProvider,
    edited,
    sourceFiles: files.map((f) => f.relativePath),
    genomeContent: genome,
  });

  if (dryRun) {
    console.log(`\n--- DRY RUN (would write to ${output}) ---\n`);
    console.log(genome);
    console.log(
      `\n--- ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum} ---`,
    );
    return;
  }

  const outputPath = join(repoPath, output);
  await writeFile(outputPath, genome + "\n");
  console.log(`Wrote genome to ${output}`);

  await writeMeta(repoPath, genomeMeta);
  console.log("Wrote metadata to .genome.meta");
  console.log(
    `\nGenome: ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum}`,
  );
}

async function update(args: string[]): Promise<void> {
  const { repoPath, provider, edit, output, dryRun } = parseArgs(args);

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

  const resolvedProvider = await resolveProvider(
    provider || (existingMeta.provider as Provider),
  );
  const context = concatenateContext(files);

  // Read existing genome for diffing after regeneration
  let oldGenome = "";
  try {
    oldGenome = await readFile(join(repoPath, output), "utf-8");
  } catch {
    // No existing file to diff against
  }

  console.log(`\nRegenerating genome via ${resolvedProvider}...`);
  let genome = await generateGenome(context, resolvedProvider);

  let edited = false;
  if (edit) {
    console.log("Running edit pass...");
    genome = await editGenome(genome, context, resolvedProvider);
    edited = true;
  }

  const genomeMeta = createMeta({
    provider: resolvedProvider,
    edited,
    sourceFiles: files.map((f) => f.relativePath),
    genomeContent: genome,
  });
  genomeMeta.version = existingMeta.version + 1;

  // Show section-level diff against previous genome
  if (oldGenome) {
    const diffs = diffGenomes(oldGenome, genome);
    console.log(`\n${summarizeDiff(diffs)}`);
  }

  if (dryRun) {
    console.log(
      `\n--- DRY RUN (would write v${genomeMeta.version} to ${output}) ---\n`,
    );
    console.log(genome);
    console.log(
      `\n--- ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum} ---`,
    );
    return;
  }

  const outputPath = join(repoPath, output);
  await writeFile(outputPath, genome + "\n");
  console.log(`Wrote updated genome to ${output}`);

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

async function diff(args: string[]): Promise<void> {
  // Mode 1: genome diff <file1> <file2> — compare two files directly
  const nonFlagArgs = args.filter((a) => !a.startsWith("-"));
  if (nonFlagArgs.length === 2) {
    const [file1, file2] = nonFlagArgs.map((f) => resolve(f));
    const old = await readFile(file1, "utf-8");
    const cur = await readFile(file2, "utf-8");
    const diffs = diffGenomes(old, cur);
    console.log(formatDiff(diffs));
    return;
  }

  // Mode 2: genome diff [path] — regenerate and compare against current CLAUDE.md
  const { repoPath, provider, output } = parseArgs(args);

  const outputPath = join(repoPath, output);
  let oldGenome: string;
  try {
    oldGenome = await readFile(outputPath, "utf-8");
  } catch {
    console.error(`No genome found at ${output}. Run 'genome init' first.`);
    process.exit(1);
  }

  const files = await discoverContextFiles(repoPath);
  if (files.length === 0) {
    console.error("No context files found.");
    process.exit(1);
  }

  const resolvedProvider = await resolveProvider(provider);
  const context = concatenateContext(files);

  console.log(`Generating fresh genome via ${resolvedProvider} for comparison...\n`);
  const newGenome = await generateGenome(context, resolvedProvider);

  const diffs = diffGenomes(oldGenome, newGenome);
  console.log(formatDiff(diffs));
}

async function merge(args: string[]): Promise<void> {
  let outputFile: string | null = null;
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputFile = args[++i];
    } else if (!arg.startsWith("-")) {
      files.push(arg);
    }
  }

  if (files.length < 2) {
    console.error("Usage: genome merge <file1> <file2> [...files] [-o output]");
    process.exit(1);
  }

  const genomes: string[] = [];
  for (const file of files) {
    genomes.push(await readFile(resolve(file), "utf-8"));
  }

  const merged = mergeGenomes(genomes);

  if (outputFile) {
    await writeFile(resolve(outputFile), merged + "\n");
    console.log(`Wrote merged genome to ${outputFile}`);
  } else {
    console.log(merged);
  }
}

function parseArgs(args: string[]): {
  repoPath: string;
  provider: Provider | null;
  edit: boolean;
  output: string;
  dryRun: boolean;
} {
  let repoPath = ".";
  let provider: Provider | null = null;
  let edit = false;
  let output = CLAUDE_MD;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--edit" || arg === "-e") {
      edit = true;
    } else if (arg === "--provider" || arg === "-p") {
      provider = args[++i] as Provider;
      if (!["claude", "codex", "gemini"].includes(provider)) {
        console.error(
          `Invalid provider: ${provider}. Use claude, codex, or gemini.`,
        );
        process.exit(1);
      }
    } else if (arg === "--output" || arg === "-o") {
      output = args[++i];
    } else if (arg === "--dry-run" || arg === "-n") {
      dryRun = true;
    } else if (!arg.startsWith("-")) {
      repoPath = arg;
    }
  }

  return { repoPath: resolve(repoPath), provider, edit, output, dryRun };
}

async function resolveProvider(
  requested: Provider | null,
): Promise<Provider> {
  if (requested) return requested;

  const detected = await detectProvider();
  if (!detected) {
    console.error(
      "No LLM CLI found. Install one of: claude, codex, gemini\n" +
        "Or specify with --provider <name>",
    );
    process.exit(1);
  }
  console.log(`Auto-detected: ${detected}`);
  return detected;
}

function printUsage(): void {
  console.log(`context-genome - Compress project context for LLM agents

Usage:
  genome init [path] [options]           Generate genome from project context files
  genome update [path] [options]         Regenerate genome from updated context
  genome status [path]                   Show genome metadata and status
  genome diff [path] [options]           Regenerate and diff against current genome
  genome diff <file1> <file2>            Compare two genome files directly
  genome merge <f1> <f2> [...] [-o out]  Merge multiple genome files

Options:
  -p, --provider <name>   LLM to use: claude, codex, gemini (auto-detected)
  -e, --edit              Run a refinement pass after generation
  -o, --output <file>     Output file (default: CLAUDE.md)
  -n, --dry-run           Preview genome without writing files
  -h, --help              Show this help

Examples:
  genome init                      # Generate genome for current directory
  genome init ../my-project        # Generate for another project
  genome init --edit               # Generate with refinement pass
  genome init -p gemini            # Use Gemini CLI
  genome init --dry-run            # Preview without writing
  genome update                    # Regenerate from updated sources
  genome status                    # Check genome version and metadata
  genome diff                      # Show what changed since last generation
  genome diff a.md b.md            # Compare two genome files
  genome merge apps/*/CLAUDE.md    # Merge monorepo genomes
  genome merge a.md b.md -o out.md # Merge and write to file`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
