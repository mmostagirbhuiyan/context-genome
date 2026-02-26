# Task: Selective Compression on Production Monorepo

## Objective
Validate that the selective compression prompt correctly classifies sections as static (compress) vs mutable (preserve) on a real production monorepo with living CLAUDE.md files.

## Test Project
Enterprise SaaS monorepo (anonymized):
- **Scale**: 9 context files, 92.4KB total input
- **Structure**: pnpm workspace with 2 apps + 3 packages, each with its own CLAUDE.md
- **Complexity**: Root CLAUDE.md contains both static architecture docs AND mutable session state (156 active sessions tracked), task lists, deployment notes with IPs, sprint tracking
- **Nested context**: 5 CLAUDE.md files with on-demand hierarchical loading
- **Slash commands**: 10 custom workflow commands in `.claude/commands/`, all reference Session State
- **Living content**: Session state updated every session, task tracking via GitHub Issues with offline fallback

## What makes this test meaningful
Previous rounds (R11-R15) tested genome compression on static documentation only. This project has a mature agentic workflow where humans edit CLAUDE.md during every session — session numbers, feature inventories, deployment IPs, sprint status. Compressing these mutable sections would break the workflow.

## Method
Run `genome init --dry-run` on the project using the selective compression prompt (v0.3.0). Examine the output for:
1. Correct classification of all sections
2. All static knowledge captured in genome notation
3. All mutable sections preserved verbatim after `<!-- GENOME:END -->` marker
4. No information loss in either category
