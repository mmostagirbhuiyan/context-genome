/**
 * The genome generation prompt with selective compression.
 * Compresses static project knowledge into genome notation.
 * Preserves mutable sections (session state, tasks, etc.) as-is.
 */
export function buildGenerationPrompt(concatenatedContext: string): string {
  return `You are a context compression specialist. Your task is to read project context files and produce a hybrid document: static project knowledge compressed into "Context Genome" notation, with mutable/living sections preserved as-is in markdown.

## Input
${concatenatedContext}

## Classification

Before compressing, classify every section of the input:

**STATIC — compress into genome notation:**
- Architecture, tech stack, versions, dependencies
- Rules, constraints, numbered guidelines
- DONTs, dead approaches, things that failed
- File/directory structure, component patterns
- API routes, database models, schemas
- Build/deploy/test commands
- Demo/test accounts, environment variables
- Testing philosophy, code standards
- Cross-cutting change traces
- Monorepo structure, package relationships

**MUTABLE — preserve as-is in original markdown:**
- Session state, session history, session numbers
- Task lists, sprint tracking, TODOs, checklists
- "Last updated" timestamps, dates
- Deployment notes with IPs/URLs that change
- In-progress work, active bugs, scratch notes
- Anything referencing a specific session, date, or current status
- Slash command references and workflow rituals
- Archive references and history pointers

## Output Format

Produce a hybrid document with TWO parts separated by a marker:

**Part 1 — Genome (compressed static knowledge):**
\`\`\`
[GENOME:ProjectName vX.X | tokens:~N | density:Nx]

§SECTION_NAME
key:value | key:value | key:value
nested-structure { item1, item2, item3 }

§ANOTHER_SECTION
compact-notation-here
\`\`\`

**Part 2 — Mutable sections (preserved markdown):**
After the genome, output the exact marker line:
<!-- GENOME:END -->

Then output ALL mutable sections in their original markdown format, exactly as they appeared in the source. Do not compress, reformat, or summarize them.

## Genome Compression Rules
1. Use § for section headers
2. Use | for inline separators
3. Use {} for grouped items
4. Use -> for flows/traces
5. Use : for key-value pairs
6. Use () for annotations/clarifications
7. Compress aggressively — eliminate articles, prepositions, filler words
8. Preserve ALL specific values: file paths, port numbers, class names, enum values, rule numbers, email addresses, passwords, commands
9. Do NOT omit any static information — every fact, rule, pattern, command, and constraint must appear in the genome
10. Include cross-cutting traces (e.g., "to add X, change files A->B->C->D")
11. Include all enums with their values
12. Include all commands with their flags
13. Include all "DON'T" rules and dead approaches

## Important
- If the input contains NO mutable sections, omit the <!-- GENOME:END --> marker entirely and output only the genome.
- If the input contains mutable sections, preserve them EXACTLY — same headings, same content, same formatting.
- The mutable sections are for humans and agents to read and update during work sessions. Do not touch them.

Output ONLY the hybrid document. No explanations, no outer markdown fences, no preamble.`;
}

/**
 * The editing/refinement prompt — adds 1-5 points accuracy (R13 validated).
 * Respects the hybrid format boundary.
 */
export function buildEditPrompt(
  genome: string,
  originalContext: string,
): string {
  return `You are a context genome editor. You have two inputs:

## Auto-Generated Genome
${genome}

## Original Source Material
${originalContext}

## Your Job (ONE editing pass)
- Check the GENOME section (everything before <!-- GENOME:END -->) for: missing facts, incorrect values, redundant entries, poor compression, structural inconsistencies
- Fix any issues you find in the genome section
- Improve compression where possible without losing information
- Ensure cross-cutting traces are complete
- Ensure all enums, commands, rules, and DON'T lists are present
- Do NOT modify anything after the <!-- GENOME:END --> marker — mutable sections must be preserved exactly

Output ONLY the refined hybrid document. No explanations, no outer markdown fences, no preamble.`;
}
