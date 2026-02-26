# context-genome

CLI tool that compresses project context files (CLAUDE.md, README, CONTRIBUTING, etc.) into a structured genome format. LLM agents read it more accurately with fewer tokens.

## The problem

CLAUDE.md files grow into walls of prose. Agents burn tokens reading them and still miss critical rules. The genome format encodes the same information in ~3x fewer tokens using structured notation — section headers, key-value pairs, and explicit DONT rules that agents actually follow.

But not everything should be compressed. Session state, task lists, deployment notes — these are living content that humans and agents update every session. Compressing them breaks workflows.

## Selective compression

The genome compresses **static** project knowledge (architecture, rules, stack, DONTs) and preserves **mutable** sections (session state, tasks, in-progress work) as-is.

The output is a hybrid document:

```
[GENOME:MyProject v1.0 | tokens:~3200 | density:3.1x]

§STACK
lang:TypeScript | fw:Next.js+Fastify | db:PostgreSQL+Prisma | ...

§RULES
1. Behavioral tests only | 2. No default exports | ...

§DONT
PDF Parser (60% accuracy) | Custom inputTypes (broke schemas) | ...

<!-- GENOME:END -->

## Session State
Last Updated: 2026-02-25 | Session 156
Features: auth, dashboard, forms, PDF generation, dark mode
...

## Active Tasks
- [ ] Fix inbox highlight bug
- [ ] Add API rate limiting
```

Everything above `<!-- GENOME:END -->` is compressed genome notation. Everything below is your original markdown, untouched. When you run `genome update`, only the genome portion is regenerated — mutable sections carry forward exactly as you left them.

## The interesting finding

In a controlled A/B test (Round 15), an agent with a 100-line genome found a real financial calculation bug that an agent reading the full 763-line documentation missed entirely.

The genome contained: `STATIC leverage for LEAPS: Never use (1+L*r)^T for options`

That one compressed DONT rule caused the agent to systematically grep every code path for compound leverage. It found an inconsistency in `simulateHybridSeries()` where compound leverage was incorrectly applied to LEAPS options — an error that grows from 13% at 1yr DTE to 42% at 3yr DTE.

The agent without the genome read the same documentation, understood the distinction correctly, verified the main loop was fine — and stopped looking. Without an explicit DONT rule, it had no reason to suspect other code paths.

The genome used 22% fewer tokens and finished 55% faster.

## Where it doesn't help much

For straightforward code tasks (Round 14: adding a feature across 7 files), the genome gave only a +2 point advantage while using 2.3x more tokens. Agents are already good at pattern-matching from existing code. The genome's value is in domain knowledge and constraint enforcement, not implementation guidance.

## Install

```bash
npm install -g context-genome
```

You need one of these CLI tools installed and authenticated:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`)
- [Codex CLI](https://github.com/openai/codex) (`codex`)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)

Auto-detects whichever you have. No API keys needed.

## Usage

```bash
genome init                        # Generate genome for current directory
genome init --dry-run              # Preview without writing
genome init --edit                 # Generate with a refinement pass
genome init -p codex               # Use Codex CLI (writes to AGENTS.md)
genome init -t claude,codex        # Write to both CLAUDE.md and AGENTS.md
genome init -t claude,cursor,copilot  # Write to all tool formats

genome update                      # Regenerate genome, preserve mutable sections
genome status                      # Check version, checksum, file status

genome diff                        # Regenerate and compare against current genome
genome diff old.md new.md          # Compare two genome files directly

genome merge a.md b.md             # Merge multiple genomes (stdout)
genome merge a.md b.md -o out.md   # Merge and write to file
```

### Output file defaults

The genome is the same regardless of where it's written. The output file is chosen based on which LLM tool will read it:

| Provider | Default output |
|----------|---------------|
| claude | CLAUDE.md |
| codex | AGENTS.md |
| gemini | CLAUDE.md |

Use `--targets` (`-t`) to write to multiple files at once. Target names: `claude`, `codex`, `cursor`, `copilot`. You can also pass raw file paths.

## How it works

1. **Discovers** context files: CLAUDE.md, AGENTS.md, README.md, CONTRIBUTING.md, package.json, Cargo.toml, nested CLAUDE.md files in monorepos, and others.
2. **Classifies** each section as static (architecture, rules, stack) or mutable (session state, tasks, in-progress work).
3. **Compresses** static sections into genome notation (~3,000-4,000 tokens of dense structured data).
4. **Preserves** mutable sections as-is in their original markdown, below the `<!-- GENOME:END -->` marker.
5. **Tracks** metadata in `.genome.meta` (version, checksum, source files, output targets).

### What gets compressed

Architecture, tech stack, versions, rules, DONTs, dead approaches, file structure, component patterns, API routes, database models, build commands, demo accounts, environment variables, testing philosophy, cross-cutting change traces.

### What stays as-is

Session state, session history, task lists, sprint tracking, TODOs, timestamps, deployment notes, in-progress work, active bugs, scratch notes — anything that changes between sessions.

### Adding new knowledge

Just write it. Add new architecture decisions, rules, or stack changes anywhere in your source files (CLAUDE.md, README, CONTRIBUTING, etc.) in plain markdown. Run `genome update` and the tool compresses the new static content into the genome while leaving your mutable sections untouched.

## Experiments

The format was validated across 15 rounds of controlled experiments on 3 model families (Claude, Codex, Gemini). Key results:

| Round | What was tested | Result |
|-------|----------------|--------|
| 6-9 | Compression techniques, attention anchors, multi-path reasoning | Established notation style and symbol conventions |
| 10 | Root derivation — can agents reconstruct project knowledge from genome alone? | Yes, with high fidelity across all 3 models |
| 11 | Real-world monorepo with 6 distributed CLAUDE.md files | 96.8% reconstruction accuracy at 3.3x compression |
| 12 | Equal token budget: genome vs prose markdown | Genome outperforms prose at same token count across all 3 models |
| 13 | Auto-generated genomes vs hand-crafted | Auto-generated scores 88-93% (hand-crafted: 93%) |
| 14 | A/B test: code implementation task (collar hedge) | +2 points, but 2.3x more tokens. Marginal for code tasks. |
| 15 | A/B test: interpretation/audit task (leverage model) | Found real bug that no-genome missed. 22% fewer tokens, 55% faster. |

Raw data and evaluations are in `experiments/`.

## License

MIT
