# Round 15: Interpretation-Heavy A/B Test — Leverage Model Audit

## Test Design
- **Task**: Audit leverage model consistency, diagnose DTE comparison bug, validate conservative offsets, verify Section 1256 tax treatment, create validation functions
- **Key difference from R14**: R14 was code-centric (add feature). R15 requires understanding financial methodology — WHY models are correct, not just HOW code works.
- **Project**: portfolio-analyzer (763-line METHODOLOGY.md with dense financial reasoning)
- **Model**: Claude Opus 4.6 for both conditions
- **Isolation**: Separate git worktrees

## Quantitative Results

| Metric | A (WITH genome) | B (WITHOUT genome) |
|--------|-----------------|-------------------|
| Tokens | 90,515 | 115,940 |
| Duration | 568s (~9.5 min) | 879s (~14.7 min) |
| Tool calls | 47 | 50 |
| Read METHODOLOGY.md | No (had genome) | Yes (763 lines) |
| Found the bug | **YES** | **NO** |
| Files edited | 3 | 3 |
| Build | SUCCESS | SUCCESS |

## The Bug

`simulateHybridSeries()` in `usePortfolioCalculations.js` (lines 1351+1366) uses **compound leverage** for LEAPS:
```javascript
let ret = spyR * spyLeapsLeverage;           // annual leveraged return
const pretax = invest * Math.pow(1 + ret, periodYears);  // COMPOUNDS it
```

The main projection loop (lines 706-707) correctly uses **static leverage**:
```javascript
const spyUnderlyingTotalReturn = Math.pow(1 + spyR, periodYears) - 1;
let spyLeapsTotalReturn = spyLeapsLeverage * spyUnderlyingTotalReturn;
```

Compound leverage (`(1+L*r)^T`) is correct for daily-rebalanced ETFs. Static leverage (`Ω × R_total`) is correct for fixed-strike LEAPS options. Using compound leverage for LEAPS makes longer DTE appear relatively better than it should, because the DTE-dependent error grows from 13% at 1yr to 42% at 3yr.

Bug confirmed real and still present in current codebase.

## Why Genome Found It, No-Genome Didn't

**Condition A** (genome) had two critical signals:
1. Genome line 88: `STATIC leverage for LEAPS: Never use (1+L*r)^T for options`
2. Genome line 30: `static-model (LEAPS): R = Ω × R_underlying (Fixed-strike approximation, no daily reset)`

Armed with the explicit NEVER rule, the agent systematically grep'd for ALL instances of compound leverage patterns (`Math.pow` near leverage variables) and found the inconsistency in `simulateHybridSeries()`.

**Condition B** (no genome) read the 763-line METHODOLOGY.md, understood the distinction perfectly, verified the main loop was correct — but **stopped looking**. Without the genome's explicit DONT rule, it lacked the suspicion to keep searching for other code paths that might use the wrong model.

## R14 vs R15 Comparison

| | R14 (Code Task) | R15 (Audit Task) |
|--|---|---|
| Task type | Add collar hedge (implementation) | Audit leverage models (interpretation) |
| Genome advantage | +2 points (92 vs 90) | BINARY (found bug vs missed) |
| Token efficiency | Genome used 2.3x MORE | Genome used 22% FEWER |
| Speed | Same (~13.5 min both) | Genome 55% faster (9.5 vs 14.7 min) |
| What genome helped with | Cross-cutting file awareness | Domain DONT rules, systematic audit |

## Conclusion

The genome's value is **task-type dependent**:

- **Code-pattern tasks**: Marginal benefit. Agents can pattern-match from existing code regardless.
- **Interpretation/audit tasks**: Decisive advantage. The genome's compressed domain knowledge and explicit DONT rules trigger systematic verification that raw code reading doesn't.

The genome's 100 lines of notation were more efficient than the 763-line METHODOLOGY.md: fewer tokens consumed, faster completion, and critically — the DONT rules (`NEVER use compound leverage for LEAPS`) created a higher suspicion level that led to finding the actual bug.
