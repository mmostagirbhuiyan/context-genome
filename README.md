# context-genome

CLI tool that compresses project context files (CLAUDE.md, README, etc.) into a structured "genome" format that LLM agents can read more accurately with fewer tokens.

## Why

LLM agents forget your architecture mid-session. Long CLAUDE.md files waste tokens on prose. The genome format encodes the same information in ~3x fewer tokens with equal or better reconstruction accuracy — validated across 13 rounds of experiments on 3 model families (Claude, Codex, Gemini).

## Install

```bash
npm install -g context-genome
```

## Usage

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Generate a genome from your project
genome init

# Generate with a refinement pass (slightly more accurate)
genome init --edit

# Point at a different project
genome init ../my-project

# Regenerate after project changes
genome update

# Check genome status
genome status
```

## What it does

1. **Discovers** context files: CLAUDE.md, AGENTS.md, README.md, package.json, nested CLAUDE.md files in monorepos
2. **Generates** a structured genome using the Anthropic API (~3,000-4,000 tokens of dense notation)
3. **Writes** the genome as your CLAUDE.md (replaces prose with genome format)
4. **Tracks** metadata in `.genome.meta` (version, checksum, source files)

The genome format uses `§` section headers, `|` separators, `{}` groups, `->` flows, and aggressive compression while preserving every specific value (file paths, ports, class names, rules, commands).

## Output

`genome init` writes two files:

- **CLAUDE.md** — the genome itself (drop-in replacement, all LLM tools read it)
- **.genome.meta** — version, checksum, source files, token estimate

## Research

The genome format was validated across 13 experimental rounds:

- **Round 12 (Equal Token Budget)**: Genome format outperforms traditional markdown at the same token budget across all 3 models tested
- **Round 13 (Auto-Generation)**: Auto-generated genomes score within 2 points of hand-crafted ones for Claude (93.3% vs 88.3%)
- **Real-world validation**: 96.8% accuracy at 3.3x compression on a production monorepo with 6 distributed CLAUDE.md files

Full experiment data is in `experiments/`.

## License

MIT
