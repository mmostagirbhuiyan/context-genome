# Round 16: Selective Compression on Production Monorepo

## Test Design
- **Task**: Validate selective compression (static vs mutable classification) on a real production project
- **Project**: Enterprise SaaS monorepo (anonymized) — 9 context files, 92.4KB input
- **Model**: Claude Sonnet 4.6 (via `claude -p`)
- **Mode**: `genome init --dry-run` (v0.3.0 selective compression prompt)

## Quantitative Results

| Metric | Value |
|--------|-------|
| Input files | 9 |
| Input size | 92.4KB |
| Output genome sections | 27 |
| Genome token estimate | ~2,800 (self-reported), ~5,644 (tool estimate) |
| Mutable sections preserved | 3 |
| Output total size | ~18.6KB |
| Static compression ratio | ~5x on static content |
| Classification accuracy | 30/30 sections correctly classified |

## Classification Results

### Static sections (compressed into genome notation) — 27 sections

All correctly identified as static:

| Section | Content type | Correct? |
|---------|-------------|----------|
| §PRODUCT | Product identity, domain, version | Yes |
| §STACK | Tech stack with versions (7 framework/tool entries) | Yes |
| §DESIGN_SYSTEM | Design system tokens, typography, colors | Yes |
| §ARCHITECTURE | Schema-driven architecture, data flow | Yes |
| §MONOREPO_LAYOUT | Workspace structure (2 apps, 3 packages) | Yes |
| §KEY_FILES | Critical file paths across monorepo | Yes |
| §SCHEMA_SPEC | Form schema specification (8 input types) | Yes |
| §DATATABLE_TYPES | Table configuration types | Yes |
| §ENTITY_FILTERS | Entity filtering patterns | Yes |
| §DB_MODELS | Database models and relationships | Yes |
| §SUBMISSION_STATES | State machine (6 states + transitions) | Yes |
| §API_ROUTES | Route patterns, auth types, versioned API | Yes |
| §COMMANDS | Build, dev, test, seed, migration commands | Yes |
| §DEPLOY | Deployment configuration | Yes |
| §UI_PATTERNS | Component patterns, header selection logic | Yes |
| §CHANGE_TRACES | Cross-cutting file change sequences | Yes |
| §TESTING | Testing philosophy (behavioral only) | Yes |
| §DEMO_ACCOUNTS | Test accounts with credentials | Yes |
| §ENV_VARS | Environment variable list | Yes |
| §FEATURE_FLAGS | Feature flag patterns | Yes |
| §SLASH_COMMANDS | 10 workflow commands with descriptions | Yes |
| §PM_CONTEXT | Project management workflow (GitHub Issues, sprint ledger) | Yes |
| §SECURITY | Authentication, tenant isolation patterns | Yes |
| §DEAD_APPROACHES | 7 abandoned approaches with reasons | Yes |
| §CRITICAL_RULES | 14 hard rules for agent behavior | Yes |
| §DOCS_POLICY | Documentation update policy | Yes |
| §PERFORMANCE | Load test results with specific metrics | Yes |

### Mutable sections (preserved verbatim) — 3 sections

All correctly identified as mutable:

| Section | Content type | Preserved verbatim? |
|---------|-------------|-------------------|
| Session State | Session number (156), feature inventory (~40 features), production URL, VM IP, current sprint status | Yes |
| Archived Sessions | Session history table with file references | Yes |
| Archived History | Archive index pointers | Yes |

## Quality Assessment

### Dead Approaches — all 7 captured with reasons
The genome correctly compressed all abandoned patterns:
- PDF parser approach (60% accuracy)
- 50+ hardcoded components (doesn't scale)
- Entity-focused pages (users think in forms)
- Custom input types (broke schemas)
- Static analysis tests (don't test behavior)
- Over-mocked unit tests (test implementation not behavior)
- Non-standard fonts (4 alternatives tried, all abandoned)

### Critical Rules — all 14 captured
Every rule compressed without information loss, including:
- Task tracking workflow (GitHub Issues as authoritative source)
- Sprint ledger offline fallback logic
- Schema-driven UI+PDF parity requirement
- No-slop policy (no emojis, no AI-isms)
- Documentation update policy

### Mutable Section Fidelity
Session State was preserved exactly as written:
- Session number (156) retained
- Complete feature inventory (~40 features) retained
- Production URL retained
- VM IP address retained
- Sprint status and issue numbers retained
- GitHub project board incident notes retained

## What Could Go Wrong (but didn't)

1. **Sprint ledger offline fallback** — Could have been classified as static (it's a rule). Correctly compressed into §CRITICAL_RULES as a rule, while the session-specific sprint status stayed in mutable Session State.

2. **Demo accounts** — Could have been classified as mutable (passwords change). Correctly classified as static — these are fixed test accounts.

3. **Performance metrics** — Load test results with specific numbers. Correctly classified as static — these are point-in-time benchmarks, not changing deployment state.

4. **Production URL** — Appears in Session State (mutable, correct) but could have been extracted as static. The URL itself is stable, but it lives within the Session State block that changes every session, so preserving the whole block verbatim is the right call.

## Comparison to Previous Rounds

| | R11 (Monorepo) | R13 (Auto-gen) | R16 (Selective) |
|--|---|---|---|
| Input | 6 CLAUDE.md files | Single CLAUDE.md | 9 files (92.4KB) |
| Task | Full compression | Full compression | Selective compression |
| Static/mutable | N/A (all static) | N/A (all static) | 27 static, 3 mutable |
| Accuracy | 96.8% | 88-93% | 100% classification (30/30) |
| Compression | 3.3x | ~3x | ~5x on static content |

## Conclusion

Selective compression works correctly on a production monorepo with living context files. The LLM correctly classified all 30 sections (27 static, 3 mutable) with zero misclassification. The genome captured all static knowledge — 7 dead approaches, 14 critical rules, full state machine, cross-cutting traces — while preserving session state, task tracking, and deployment notes verbatim.

The key finding: the classification is not difficult for the LLM. The static/mutable distinction maps cleanly to what the content *is about*, not how it's formatted. Architecture docs are always static. Session numbers are always mutable. The prompt's classification guidance is sufficient — no complex heuristics needed.
