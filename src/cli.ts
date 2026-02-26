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
import { createMeta, writeMeta, readMeta, checksumFiles } from "./meta.js";
import { diffGenomes, formatDiff, summarizeDiff } from "./diff.js";
import { mergeGenomes } from "./merge.js";
import { splitHybrid, joinHybrid } from "./parse.js";

const PROVIDER_DEFAULTS: Record<string, string> = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  gemini: "CLAUDE.md",
};

const KNOWN_TARGETS: Record<string, string> = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: ".cursorrules",
  copilot: ".github/copilot-instructions.md",
};

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
  const { repoPath, provider, edit, output, targets, dryRun } = parseArgs(args);

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
  const outputs = resolveOutputs(output, targets, resolvedProvider);
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
    sourceChecksums: checksumFiles(files),
    genomeContent: genome,
    outputFiles: outputs,
  });

  if (dryRun) {
    console.log(`\n--- DRY RUN (would write to ${outputs.join(", ")}) ---\n`);
    console.log(genome);
    console.log(
      `\n--- ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum} ---`,
    );
    return;
  }

  for (const out of outputs) {
    const outPath = join(repoPath, out);
    await writeFile(outPath, genome + "\n");
    console.log(`Wrote genome to ${out}`);
  }

  await writeMeta(repoPath, genomeMeta);
  console.log("Wrote metadata to .genome.meta");
  console.log(
    `\nGenome: ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum}`,
  );
}

async function update(args: string[]): Promise<void> {
  const { repoPath, provider, edit, output, targets, dryRun } = parseArgs(args);

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
  // Use stored output files from meta, falling back to flag/provider defaults
  const outputs = output || targets.length > 0
    ? resolveOutputs(output, targets, resolvedProvider)
    : existingMeta.outputFiles || resolveOutputs(output, targets, resolvedProvider);
  const context = concatenateContext(files);

  // Read existing file and split into genome + mutable portions
  let oldContent = "";
  let existingMutable = "";
  try {
    oldContent = await readFile(join(repoPath, outputs[0]), "utf-8");
    const split = splitHybrid(oldContent);
    existingMutable = split.mutable;
  } catch {
    // No existing file
  }

  console.log(`\nRegenerating genome via ${resolvedProvider}...`);
  let genome = await generateGenome(context, resolvedProvider);

  let edited = false;
  if (edit) {
    console.log("Running edit pass...");
    genome = await editGenome(genome, context, resolvedProvider);
    edited = true;
  }

  // The LLM may produce its own mutable section from source files.
  // Merge: use the LLM's mutable output for newly discovered mutable content,
  // but prefer the existing mutable section (it has live human edits).
  const newSplit = splitHybrid(genome);
  const finalMutable = existingMutable || newSplit.mutable;
  const finalOutput = joinHybrid(newSplit.genome, finalMutable);

  const genomeMeta = createMeta({
    provider: resolvedProvider,
    edited,
    sourceFiles: files.map((f) => f.relativePath),
    sourceChecksums: checksumFiles(files),
    genomeContent: finalOutput,
    outputFiles: outputs,
  });
  genomeMeta.version = existingMeta.version + 1;

  // Show section-level diff against previous genome (genome portion only)
  if (oldContent) {
    const oldSplit = splitHybrid(oldContent);
    const diffs = diffGenomes(oldSplit.genome, newSplit.genome);
    console.log(`\n${summarizeDiff(diffs)}`);
  }

  if (dryRun) {
    console.log(
      `\n--- DRY RUN (would write v${genomeMeta.version} to ${outputs.join(", ")}) ---\n`,
    );
    console.log(finalOutput);
    console.log(
      `\n--- ~${genomeMeta.tokenEstimate} tokens | checksum: ${genomeMeta.checksum} ---`,
    );
    return;
  }

  for (const out of outputs) {
    const outPath = join(repoPath, out);
    await writeFile(outPath, finalOutput + "\n");
    console.log(`Wrote updated genome to ${out}`);
  }

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

  const { createHash } = await import("node:crypto");
  const outputFiles = meta.outputFiles || ["CLAUDE.md"];
  const fileStatuses: string[] = [];

  for (const file of outputFiles) {
    try {
      const content = await readFile(join(repoPath, file), "utf-8");
      const fileChecksum = createHash("sha256")
        .update(content)
        .digest("hex")
        .slice(0, 16);
      const modified = fileChecksum !== meta.checksum;
      fileStatuses.push(`${file}${modified ? " (MODIFIED)" : ""}`);
    } catch {
      fileStatuses.push(`${file} (MISSING)`);
    }
  }

  // Check source file staleness
  const staleFiles: string[] = [];
  const newFiles: string[] = [];
  if (meta.sourceChecksums) {
    const currentFiles = await discoverContextFiles(repoPath);
    for (const file of currentFiles) {
      const oldChecksum = meta.sourceChecksums[file.relativePath];
      if (!oldChecksum) {
        newFiles.push(file.relativePath);
      } else {
        const { createHash: hashFn } = await import("node:crypto");
        const currentChecksum = hashFn("sha256")
          .update(file.content)
          .digest("hex")
          .slice(0, 16);
        if (currentChecksum !== oldChecksum) {
          staleFiles.push(file.relativePath);
        }
      }
    }
  }

  console.log(`Genome v${meta.version}`);
  console.log(`  Generated: ${meta.generatedAt}`);
  console.log(
    `  Provider:  ${meta.provider}${meta.edited ? " (with edit pass)" : ""}`,
  );
  console.log(`  Tokens:    ~${meta.tokenEstimate}`);
  console.log(`  Sources:   ${meta.sourceFiles.join(", ")}`);
  console.log(`  Outputs:   ${fileStatuses.join(", ")}`);
  console.log(`  Checksum:  ${meta.checksum}`);

  if (staleFiles.length > 0 || newFiles.length > 0) {
    console.log(`\n  STALE — source files changed since last generation:`);
    for (const f of staleFiles) {
      console.log(`    ~ ${f} (modified)`);
    }
    for (const f of newFiles) {
      console.log(`    + ${f} (new)`);
    }
    console.log(`\n  Run 'genome update' to regenerate.`);
  }
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

  // Mode 2: genome diff [path] — regenerate and compare against current genome
  const { repoPath, provider, output, targets } = parseArgs(args);

  const existingMeta = await readMeta(repoPath);
  const resolvedProvider = await resolveProvider(provider || (existingMeta?.provider as Provider) || null);
  const outputs = output || targets.length > 0
    ? resolveOutputs(output, targets, resolvedProvider)
    : existingMeta?.outputFiles || resolveOutputs(output, targets, resolvedProvider);
  const primaryOutput = outputs[0];

  let oldGenome: string;
  try {
    oldGenome = await readFile(join(repoPath, primaryOutput), "utf-8");
  } catch {
    console.error(`No genome found at ${primaryOutput}. Run 'genome init' first.`);
    process.exit(1);
  }

  const files = await discoverContextFiles(repoPath);
  if (files.length === 0) {
    console.error("No context files found.");
    process.exit(1);
  }

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
  output: string | null;
  targets: string[];
  dryRun: boolean;
} {
  let repoPath = ".";
  let provider: Provider | null = null;
  let edit = false;
  let output: string | null = null;
  let targets: string[] = [];
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
    } else if (arg === "--targets" || arg === "-t") {
      targets = args[++i].split(",").map((t) => {
        const known = KNOWN_TARGETS[t.trim()];
        if (known) return known;
        // Allow raw file paths too
        return t.trim();
      });
    } else if (arg === "--dry-run" || arg === "-n") {
      dryRun = true;
    } else if (!arg.startsWith("-")) {
      repoPath = arg;
    }
  }

  return { repoPath: resolve(repoPath), provider, edit, output, targets, dryRun };
}

/**
 * Resolve which files to write the genome to.
 * Priority: --output flag > --targets flag > provider default.
 */
function resolveOutputs(
  output: string | null,
  targets: string[],
  provider: Provider,
): string[] {
  if (output) return [output];
  if (targets.length > 0) return targets;
  return [PROVIDER_DEFAULTS[provider] || "CLAUDE.md"];
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
  -o, --output <file>     Output file (default: auto from provider)
  -t, --targets <list>    Write to multiple files: claude,codex,cursor,copilot
  -n, --dry-run           Preview genome without writing files
  -h, --help              Show this help

Output defaults by provider:
  claude -> CLAUDE.md    codex -> AGENTS.md    gemini -> CLAUDE.md

Target names map to:
  claude  -> CLAUDE.md                  cursor -> .cursorrules
  codex   -> AGENTS.md                  copilot -> .github/copilot-instructions.md

Examples:
  genome init                           # Auto-detect provider, write its default
  genome init -p codex                  # Write to AGENTS.md
  genome init -t claude,codex           # Write to both CLAUDE.md and AGENTS.md
  genome init -t claude,cursor,copilot  # Write to all three tool formats
  genome init --edit                    # Generate with refinement pass
  genome init --dry-run                 # Preview without writing
  genome update                         # Regenerate (remembers output targets)
  genome status                         # Check version and file status
  genome diff                           # Show what changed since last generation
  genome diff a.md b.md                 # Compare two genome files
  genome merge apps/*/CLAUDE.md         # Merge monorepo genomes
  genome merge a.md b.md -o out.md      # Merge and write to file`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
