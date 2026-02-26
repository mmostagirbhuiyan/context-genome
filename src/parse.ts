export interface GenomeSection {
  name: string;
  content: string;
}

export interface ParsedGenome {
  header: string;
  sections: GenomeSection[];
}

/**
 * Parse a genome string into its header and named sections.
 * Splits on §SECTION_NAME markers. Everything before the first § is the header.
 */
export function parseGenome(raw: string): ParsedGenome {
  const lines = raw.split("\n");
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
