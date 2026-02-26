import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

export interface GenomeMeta {
  version: number;
  generatedAt: string;
  provider: string;
  edited: boolean;
  checksum: string;
  sourceFiles: string[];
  sourceChecksums: Record<string, string>;
  outputFiles: string[];
  tokenEstimate: number;
}

const META_FILENAME = ".genome.meta";

export function createMeta(opts: {
  provider: string;
  edited: boolean;
  sourceFiles: string[];
  sourceChecksums: Record<string, string>;
  genomeContent: string;
  outputFiles: string[];
}): GenomeMeta {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: opts.provider,
    edited: opts.edited,
    checksum: checksum(opts.genomeContent + "\n"),
    sourceFiles: opts.sourceFiles,
    sourceChecksums: opts.sourceChecksums,
    outputFiles: opts.outputFiles,
    tokenEstimate: estimateTokens(opts.genomeContent),
  };
}

/**
 * Checksum a set of discovered files for staleness detection.
 */
export function checksumFiles(
  files: { relativePath: string; content: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of files) {
    result[f.relativePath] = checksum(f.content);
  }
  return result;
}

export async function writeMeta(
  repoPath: string,
  meta: GenomeMeta,
): Promise<string> {
  const metaPath = join(repoPath, META_FILENAME);
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n");
  return metaPath;
}

export async function readMeta(repoPath: string): Promise<GenomeMeta | null> {
  const metaPath = join(repoPath, META_FILENAME);
  try {
    const content = await readFile(metaPath, "utf-8");
    return JSON.parse(content) as GenomeMeta;
  } catch {
    return null;
  }
}

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Token estimate calibrated from R12 experiment data:
 * ~3,170 tokens at ~10,100 chars = ~3.2 chars per token for genome notation.
 * Genome notation is denser than prose (~4 chars/token) due to symbols and short tokens.
 */
function estimateTokens(content: string): number {
  return Math.round(content.length / 3.2);
}
