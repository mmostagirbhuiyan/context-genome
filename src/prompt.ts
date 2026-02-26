/**
 * The genome generation prompt — validated across 13 rounds of experiments.
 * R13 proved this prompt produces 88-93% accuracy genomes from raw context files.
 */
export function buildGenerationPrompt(concatenatedContext: string): string {
  return `You are a context compression specialist. Your task is to read project context files and produce a "Context Genome" — a compressed structured notation that captures ALL project knowledge in minimal tokens.

## Input
${concatenatedContext}

## Output Format
Produce a Context Genome using this notation style (follow it precisely):

\`\`\`
[GENOME:ProjectName vX.X | tokens:~N | density:Nx]

§SECTION_NAME
key:value | key:value | key:value
nested-structure { item1, item2, item3 }

§ANOTHER_SECTION
compact-notation-here
\`\`\`

## Rules
1. Use § for section headers
2. Use | for inline separators
3. Use {} for grouped items
4. Use -> for flows/traces
5. Use : for key-value pairs
6. Use () for annotations/clarifications
7. Compress aggressively — eliminate articles, prepositions, filler words
8. Preserve ALL specific values: file paths, port numbers, class names, enum values, rule numbers, email addresses, passwords, commands
9. Do NOT omit any information from the source — every fact, rule, pattern, command, and constraint must appear
10. Target roughly 3,000-4,000 tokens of dense notation
11. Include cross-cutting traces (e.g., "to add X, change files A->B->C->D")
12. Include all enums with their values
13. Include all commands with their flags
14. Include all "DON'T" rules

## What to capture (non-exhaustive)
- Product identity, domain, repos, URLs
- Tech stack with versions
- Monorepo/project structure
- All rules (numbered if they exist)
- Dead approaches / things that don't work
- UI patterns and requirements
- API patterns and routes
- Build/deployment flows
- Database models, seeds, commands
- Testing philosophy
- Workflow processes
- Demo/test accounts
- Architecture decisions
- Environment variables
- Component names, hook names, key files
- Cross-cutting change traces

Output ONLY the genome. No explanations, no markdown fences wrapping it, no preamble.`;
}

/**
 * The editing/refinement prompt — adds 1-5 points accuracy (R13 validated).
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
- Check the genome for: missing facts, incorrect values, redundant entries, poor compression, structural inconsistencies
- Fix any issues you find
- Improve compression where possible without losing information
- Ensure cross-cutting traces are complete
- Ensure all enums, commands, rules, and DON'T lists are present
- Target ~3,000-3,500 tokens of output

Output ONLY the refined genome. No explanations, no markdown fences, no preamble.`;
}
