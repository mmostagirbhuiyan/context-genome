import { parseGenome, formatGenome, type ParsedGenome } from "./parse.js";

/**
 * Merge multiple genome strings into one.
 *
 * Strategy:
 * - Header: taken from the first genome
 * - Sections: iterated in order across all genomes. For duplicate section names,
 *   content lines are merged with deduplication (preserving order from first occurrence).
 */
export function mergeGenomes(genomeStrings: string[]): string {
  if (genomeStrings.length === 0) return "";
  if (genomeStrings.length === 1) return genomeStrings[0];

  const parsed = genomeStrings.map(parseGenome);
  const merged = mergeFromParsed(parsed);
  return formatGenome(merged);
}

function mergeFromParsed(genomes: ParsedGenome[]): ParsedGenome {
  const header = genomes[0].header;

  // Ordered map of section name -> merged lines
  const sectionOrder: string[] = [];
  const sectionLines = new Map<string, string[]>();

  for (const genome of genomes) {
    for (const section of genome.sections) {
      if (!sectionLines.has(section.name)) {
        sectionOrder.push(section.name);
        sectionLines.set(section.name, []);
      }

      const existing = sectionLines.get(section.name)!;
      const existingSet = new Set(existing);
      const newLines = section.content.split("\n");

      for (const line of newLines) {
        if (!existingSet.has(line)) {
          existing.push(line);
          existingSet.add(line);
        }
      }
    }
  }

  return {
    header,
    sections: sectionOrder.map((name) => ({
      name,
      content: sectionLines.get(name)!.join("\n"),
    })),
  };
}
