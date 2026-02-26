# Task: Audit & Fix the Leverage Model Inconsistency

A user reports that when they compare 1.4-year DTE vs 2.5-year DTE LEAPS on SPY, the 2.5-year option shows higher 30-year terminal value. They say this contradicts the project's own methodology which states "shorter DTE strictly dominates."

## Your job

Investigate, diagnose, and fix this issue. The investigation requires understanding:

1. **Which leverage model applies to LEAPS and why.** The project uses two different leverage models for two different instrument types. Identify which model each instrument uses, explain the mathematical basis, and verify the code implements the correct one. If you find the wrong model being used anywhere for LEAPS, fix it.

2. **The DTE optimization result.** The methodology states shorter DTE with higher omega strictly dominates longer DTE at every tax rate. Verify this claim by tracing the math: show how the leverage interpolation formula (`SPY: L = 4.2 - (DTE - 0.5) * 0.4`) interacts with the compounding mechanics over 30 years. Explain why more frequent rolls at higher leverage overcome the additional tax events.

3. **Tax interaction with roll frequency.** At 1.4yr DTE, the investor rolls ~21 times over 30 years. At 2.5yr DTE, they roll ~12 times. Each roll is a taxable event. Show that the leverage advantage compounds multiplicatively while the tax drag is additive — this is the key insight. Verify the code handles this correctly for all 4 tax strategies (standard, act60, deferred_wrapper, offshore).

4. **Conservative offset validation.** The project claims a 2-5% annualized performance buffer from conservative parameter choices. Identify at least 4 specific conservative offsets in the code and verify they match the methodology's claimed values:
   - LEAPS leverage vs actual market omega
   - Overflow ETF leverage (UPRO 1.7x, TQQQ 1.8x) vs actual effective leverage
   - Skew multiplier for hedge pricing
   - Static leverage model error (~15% overstatement)

5. **The "singular assumption" test.** The methodology claims the entire model reduces to one assumption: US equities trend upward over any 30-year window. Write a validation function `validateModelAssumptions()` in a new file `src/calculations/modelValidation.js` that:
   - Takes the model's output (hybrid final value, CAGR, max drawdown) and the input parameters
   - Checks that the result is consistent with positive long-term drift (final value > initial after 30yr at reasonable inputs)
   - Checks that static leverage is used for LEAPS (not compound)
   - Checks that compound leverage is used for ETFs (not static)
   - Checks that hedge costs use Section 1256 blended rate only when tax strategy allows it
   - Returns a structured report of which assumptions hold and which are violated
   - Include clear JSDoc explaining WHY each check exists, referencing the specific methodology section

6. **Write a test scenario.** Add a function `runDTEComparisonScenario()` in the same file that:
   - Runs the model at DTE = 1.4yr and DTE = 2.5yr with identical inputs
   - Returns both terminal values and CAGRs
   - Asserts that 1.4yr DTE produces higher terminal value (per methodology Section 1.4)
   - If the assertion fails, the fix belongs in usePortfolioCalculations.js

## Constraints
- You must understand the DIFFERENCE between static leverage (`Ω × totalReturn`) and compound leverage (`(1 + L × r)^T`) and why each applies to different instruments
- You must understand Section 1256 blended rate (28.32%) and when it does/doesn't apply
- You must reference the correct methodology for each claim — don't guess
- The new file should be importable and callable from the browser console for verification
- Do NOT change any existing calculation logic unless you find an actual bug
