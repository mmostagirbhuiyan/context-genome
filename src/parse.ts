export interface GenomeSection {
  name: string;
  content: string;
}

export interface ParsedGenome {
  header: string;
  sections: GenomeSection[];
}

export interface HybridGenome {
  genome: string;
  mutable: string;
}

const GENOME_END_MARKER = "<!-- GENOME:END -->";

/**
 * Split a hybrid document into genome and mutable portions.
 * If no marker is present, the entire content is treated as genome.
 */
export function splitHybrid(content: string): HybridGenome {
  const idx = content.indexOf(GENOME_END_MARKER);
  if (idx === -1) {
    return { genome: content.trim(), mutable: "" };
  }
  return {
    genome: content.slice(0, idx).trim(),
    mutable: content.slice(idx + GENOME_END_MARKER.length).trim(),
  };
}

/**
 * Join genome and mutable portions into a hybrid document.
 */
export function joinHybrid(genome: string, mutable: string): string {
  if (!mutable) return genome;
  return `${genome}\n\n${GENOME_END_MARKER}\n\n${mutable}`;
}

/**
 * Check if a document contains a GENOME:END marker.
 */
export function isHybrid(content: string): boolean {
  return content.includes(GENOME_END_MARKER);
}

/**
 * Parse a genome string into its header and named sections.
 * Handles hybrid documents by parsing only the genome portion.
 * Splits on §SECTION_NAME markers. Everything before the first § is the header.
 */
export function parseGenome(raw: string): ParsedGenome {
  const { genome } = splitHybrid(raw);
  const lines = genome.split("\n");
  let header = "";
  const sections: GenomeSection[] = [];
  let currentSection: GenomeSection | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^§(\S+)\s*$/);
    if (sectionMatch) {
      if (currentSection) {
        currentSection.content = currentSection.content.trimEnd();
        sections.push(currentSection);
      }
      currentSection = { name: sectionMatch[1], content: "" };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    } else {
      header += line + "\n";
    }
  }

  if (currentSection) {
    currentSection.content = currentSection.content.trimEnd();
    sections.push(currentSection);
  }

  return { header: header.trimEnd(), sections };
}

/**
 * Reconstruct a genome string from parsed sections.
 */
export function formatGenome(genome: ParsedGenome): string {
  const parts = [genome.header];
  for (const section of genome.sections) {
    parts.push(`\n§${section.name}\n${section.content}`);
  }
  return parts.join("\n");
}
