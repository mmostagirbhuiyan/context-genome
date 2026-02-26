import { parseGenome } from "./parse.js";

export interface SectionDiff {
  name: string;
  type: "added" | "removed" | "changed" | "unchanged";
  old?: string;
  new?: string;
}

/**
 * Diff two genomes at the section level.
 * Returns a list of section diffs ordered by appearance in the new genome,
 * with removed sections appended at the end.
 */
export function diffGenomes(
  oldRaw: string,
  newRaw: string,
): SectionDiff[] {
  const oldGenome = parseGenome(oldRaw);
  const newGenome = parseGenome(newRaw);

  const oldMap = new Map(oldGenome.sections.map((s) => [s.name, s.content]));
  const newMap = new Map(newGenome.sections.map((s) => [s.name, s.content]));

  const diffs: SectionDiff[] = [];
  const seen = new Set<string>();

  // Walk new sections in order
  for (const section of newGenome.sections) {
    seen.add(section.name);
    const oldContent = oldMap.get(section.name);

    if (oldContent === undefined) {
      diffs.push({ name: section.name, type: "added", new: section.content });
    } else if (oldContent === section.content) {
      diffs.push({ name: section.name, type: "unchanged" });
    } else {
      diffs.push({
        name: section.name,
        type: "changed",
        old: oldContent,
        new: section.content,
      });
    }
  }

  // Removed sections (in old but not in new)
  for (const section of oldGenome.sections) {
    if (!seen.has(section.name)) {
      diffs.push({
        name: section.name,
        type: "removed",
        old: section.content,
      });
    }
  }

  return diffs;
}

/**
 * Format diffs for terminal display with +/- prefixes.
 */
export function formatDiff(diffs: SectionDiff[]): string {
  const hasChanges = diffs.some((d) => d.type !== "unchanged");
  if (!hasChanges) return "No changes detected.";

  const lines: string[] = [];
  const added = diffs.filter((d) => d.type === "added").length;
  const removed = diffs.filter((d) => d.type === "removed").length;
  const changed = diffs.filter((d) => d.type === "changed").length;
  const unchanged = diffs.filter((d) => d.type === "unchanged").length;

  lines.push(
    `${diffs.length} sections: ${changed} changed, ${added} added, ${removed} removed, ${unchanged} unchanged\n`,
  );

  for (const diff of diffs) {
    switch (diff.type) {
      case "added":
        lines.push(`+ §${diff.name} (new section)`);
        for (const line of diff.new!.split("\n")) {
          lines.push(`+   ${line}`);
        }
        lines.push("");
        break;
      case "removed":
        lines.push(`- §${diff.name} (removed)`);
        for (const line of diff.old!.split("\n")) {
          lines.push(`-   ${line}`);
        }
        lines.push("");
        break;
      case "changed":
        lines.push(`~ §${diff.name} (changed)`);
        const oldLines = diff.old!.split("\n");
        const newLines = diff.new!.split("\n");
        // Simple line-level diff: show removed then added
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);
        for (const line of oldLines) {
          if (!newSet.has(line)) {
            lines.push(`-   ${line}`);
          }
        }
        for (const line of newLines) {
          if (!oldSet.has(line)) {
            lines.push(`+   ${line}`);
          }
        }
        lines.push("");
        break;
      // unchanged: skip
    }
  }

  return lines.join("\n");
}

/**
 * Short summary of diff results (for use in `genome update`).
 */
export function summarizeDiff(diffs: SectionDiff[]): string {
  const added = diffs.filter((d) => d.type === "added").length;
  const removed = diffs.filter((d) => d.type === "removed").length;
  const changed = diffs.filter((d) => d.type === "changed").length;

  if (added === 0 && removed === 0 && changed === 0) {
    return "No section-level changes.";
  }

  const parts: string[] = [];
  if (changed) parts.push(`${changed} changed`);
  if (added) parts.push(`${added} added`);
  if (removed) parts.push(`${removed} removed`);
  return `Sections: ${parts.join(", ")}`;
}
