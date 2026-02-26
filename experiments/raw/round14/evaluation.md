# A/B Test: Genome Context vs No Context — Collar Hedge Implementation

## Test Design
- **Task**: Add collar hedge strategy (protective put + covered call) across 7+ files
- **Project**: portfolio-analyzer (financial simulation engine)
- **Condition A**: WITH genome CLAUDE.md (~1913 tokens, 117 lines)
- **Condition B**: WITHOUT genome (no CLAUDE.md, must explore codebase)
- **Model**: Same Claude Opus 4.6 for both conditions
- **Isolation**: Separate git worktrees (no cross-contamination)

## Quantitative Results

| Metric | Condition A (WITH genome) | Condition B (WITHOUT genome) |
|--------|--------------------------|------------------------------|
| **Score** | **92/100** | **90/100** |
| **Tokens used** | 45,386 | 19,887 |
| **Duration** | ~13.4 min | ~13.6 min |
| **Tool calls** | 118 | 116 |
| **Reads** | 65 | 64 |
| **Edits** | 27 | 29 |
| **Writes** | 1 | 1 |
| **Greps** | 25 | 22 |
| **Files read** | 13 | 11 |
| **Files edited** | 7 (excl summary) | 9 (excl summary) |
| **Build result** | SUCCESS (881 modules) | SUCCESS (881 modules) |
| **ESLint check** | Ran (0 new errors) | Not run |

## Category Scores (0-10)

| Category | A (genome) | B (no genome) |
|----------|-----------|---------------|
| Core math correctness | 9 | 9 |
| Constants/config | 10 | 10 |
| State management | 9 | 9 |
| Monte Carlo integration | 8 | 9 |
| VaR integration | 8 | 9 |
| Risk metrics | 9 | 9 |
| UI completeness | 9 | 8 |
| Prop threading completeness | 10 | 8 |
| Tax treatment correctness | 10 | 10 |
| Build verification | 10 | 9 |
| **TOTAL** | **92/100** | **90/100** |

## Where Genome Helped
1. **Found legacy InvestmentCalculator.jsx** — genome listed it as "Primary UI/Dashboard", B missed it entirely
2. **Triggered ESLint verification** — more confidence from knowing project linting
3. **Prop threading completeness** — genome mapped the component hierarchy

## Where Genome Did NOT Help
1. Core math quality **identical** — both got BS pricing, skew adjustments, NDX scaling right
2. Tax treatment (Section 1256 blended rate, short-term penalty) **identical**
3. B **slightly better** on Monte Carlo and VaR integration
4. Same wall-clock time
5. **A used 2.3x more tokens** (agent cross-referenced genome notation verbosely)

## Post-Test Architecture Analysis

### Initial "Slop" Diagnosis (WRONG)
Both agents were initially suspected of adding redundant collar clamping in downstream files. The hypothesis: usePortfolioCalculations.js is the SSOT orchestrator, so collar logic should only live there.

### Actual Finding (After Code Review)
The project has **3 independent simulation engines**:
1. **Deterministic year-by-year** (orchestrator main loop) — direct return calculations
2. **Monte Carlo GBM** (monteCarloSimulation.js) — generates own random paths via Box-Muller
3. **Block-bootstrap VaR** (orchestrator's simulateLeveragedPath/simulateHybridPath) — resamples historical returns

All three legitimately need collar clamping independently. The Monte Carlo module does NOT receive orchestrator returns — it generates its own. The VaR module (valueAtRisk.js) is pure math on final values, correctly untouched by both agents.

### Real DRY Violation
Collar preset values hardcoded in `computeCollarBounds()` in monteCarloSimulation.js instead of importing from `COLLAR_CONFIG` in constants.js.

### Lesson
Verify architecture before diagnosing slop. Independent simulation engines are not redundant logic.

## Conclusion
Marginal quality edge (+2 points) at 2.3x token cost. Genome's value is **cross-cutting awareness** (non-obvious files to touch), not implementation quality. Value proposition likely scales with codebase size and scattered context.
