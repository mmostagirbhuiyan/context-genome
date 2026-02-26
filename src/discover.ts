import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const CONTEXT_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  "CURSORRULES",
  ".cursorrules",
  "COPILOT.md",
  ".github/copilot-instructions.md",
  "README.md",
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
];

const NESTED_CLAUDE_PATTERNS = [
  "apps/*/CLAUDE.md",
  "packages/*/CLAUDE.md",
  "services/*/CLAUDE.md",
  "src/CLAUDE.md",
  "docs/CLAUDE.md",
];

interface DiscoveredFile {
  path: string;
  relativePath: string;
  content: string;
  size: number;
}

export async function discoverContextFiles(
  repoPath: string,
): Promise<DiscoveredFile[]> {
  const found: DiscoveredFile[] = [];

  // Check top-level context files
  for (const file of CONTEXT_FILES) {
    const fullPath = join(repoPath, file);
    try {
      const content = await readFile(fullPath, "utf-8");
      const stats = await stat(fullPath);
      found.push({
        path: fullPath,
        relativePath: file,
        content,
        size: stats.size,
      });
    } catch {
      // File doesn't exist, skip
    }
  }

  // Check nested CLAUDE.md patterns
  for (const pattern of NESTED_CLAUDE_PATTERNS) {
    const parts = pattern.split("*");
    if (parts.length !== 2) continue;

    const parentDir = join(repoPath, parts[0]);
    try {
      const entries = await readdir(parentDir);
      for (const entry of entries) {
        const fullPath = join(parentDir, entry, parts[1].replace(/^\//, ""));
        try {
          const content = await readFile(fullPath, "utf-8");
          const stats = await stat(fullPath);
          const relPath = relative(repoPath, fullPath);
          // Skip if already found (e.g., top-level CLAUDE.md)
          if (!found.some((f) => f.relativePath === relPath)) {
            found.push({
              path: fullPath,
              relativePath: relPath,
              content,
              size: stats.size,
            });
          }
        } catch {
          // File doesn't exist in this subdirectory
        }
      }
    } catch {
      // Parent directory doesn't exist
    }
  }

  // Also check for sprints/CLAUDE.md one level up (common pattern)
  const parentSprints = join(repoPath, "..", "sprints", "CLAUDE.md");
  try {
    const content = await readFile(parentSprints, "utf-8");
    const stats = await stat(parentSprints);
    found.push({
      path: parentSprints,
      relativePath: "../sprints/CLAUDE.md",
      content,
      size: stats.size,
    });
  } catch {
    // Not found
  }

  return found;
}

export function concatenateContext(files: DiscoveredFile[]): string {
  return files
    .map((f) => `=== ${f.relativePath} ===\n${f.content}`)
    .join("\n\n");
}

export function summarizeDiscovery(files: DiscoveredFile[]): string {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const lines = [
    `Found ${files.length} context file${files.length === 1 ? "" : "s"} (${formatBytes(totalSize)}):`,
    ...files.map((f) => `  ${f.relativePath} (${formatBytes(f.size)})`),
  ];
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
