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
  tokenEstimate: number;
}

const META_FILENAME = ".genome.meta";

export function createMeta(opts: {
  provider: string;
  edited: boolean;
  sourceFiles: string[];
  genomeContent: string;
}): GenomeMeta {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: opts.provider,
    edited: opts.edited,
    checksum: checksum(opts.genomeContent),
    sourceFiles: opts.sourceFiles,
    tokenEstimate: estimateTokens(opts.genomeContent),
  };
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
 * Rough token estimate: ~4 chars per token for genome notation.
 * This is approximate — genome notation is denser than prose.
 */
function estimateTokens(content: string): number {
  return Math.round(content.length / 4);
}
