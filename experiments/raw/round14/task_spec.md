# Task: Add Collar Hedge Strategy

Add a new "Collar" hedge strategy to the portfolio analyzer. A collar combines a protective put (already exists as the capital/tail/catastrophic hedges) with a covered call that caps upside but generates premium to offset put costs.

## Requirements

### 1. Core Math (hedgePricing.js)
- Add `calculateCollarCost(spotPrice, putStrike, callStrike, volatility, timeToExpiry, riskFreeRate)` that:
  - Prices the protective put using existing Black-Scholes put pricing
  - Prices the covered call using Black-Scholes call pricing
  - Returns net cost = put cost - call premium (can be negative = "zero-cost collar")
  - Apply the existing skew multiplier (1.375x) to the put leg only
  - Apply an inverse skew adjustment of 0.85x to the call leg (OTM calls are cheaper)
  - Support the NDX volatility scaling factor (1.3x) for QQQ positions

### 2. Collar Configuration (constants.js)
- Add collar presets: `conservative` (cap at +15% upside, floor at -10%), `balanced` (cap at +25%, floor at -15%), `aggressive` (cap at +40%, floor at -20%)
- Add `COLLAR_CALL_SKEW_DISCOUNT: 0.85`
- Add default collar type: `balanced`

### 3. State Management (usePortfolioCalculations.js)
- Add collar toggle state (independent per strategy: LEAPS, Leveraged ETF)
- Add collar preset selector state
- When collar is active, modify the return calculation:
  - Floor returns at the put strike level (like existing hedges)
  - Cap returns at the call strike level (NEW — this is the key difference)
  - Deduct net collar cost from annual returns
- Collar and existing hedges should be mutually exclusive (can't have both active)
- Ensure the collar cost flows through the tax logic correctly:
  - Put leg gets Section 1256 blended rate (28.32%) treatment like existing hedges
  - Call premium received is short-term income (use short-term penalty rate: longTermRate * 1.85)
  - Net tax impact must be calculated considering both legs separately

### 4. Monte Carlo Integration (monteCarloSimulation.js)
- When collar is active, clamp each simulation path's annual return between floor and cap
- The collar should reduce the width of the percentile bands (10th/90th should converge)
- Verify that the 50th percentile (median) is slightly lower than unhedged due to net cost

### 5. VaR Impact (valueAtRisk.js)
- Collar should significantly reduce VaR and CVaR since tail losses are floored
- The VaR dashboard cards should reflect collar-adjusted risk metrics
- Add a "Collar Active" indicator to the VaR dashboard when collar is enabled

### 6. Risk Metrics (riskMetrics.js)
- Recalculate Sortino ratio with collar (downside deviation should decrease)
- Max drawdown should be capped at collar floor level
- Omega ratio should improve due to truncated left tail

### 7. UI (RiskManagement.jsx)
- Add collar toggle in the hedge management section
- Show collar preset selector (conservative/balanced/aggressive)
- Display net collar cost breakdown: put cost, call premium, net cost
- Show effective return range (floor to cap) based on selected preset
- Collar toggle should disable when existing hedges are active (and vice versa)

## Constraints
- Must use the existing Black-Scholes implementation — do not rewrite pricing
- Must respect the existing LEAPS static leverage model (not compound)
- Must handle the DTE-dependent leverage interpolation for LEAPS positions
- Tax treatment must be correct for the user's selected tax strategy (standard/act60/deferred/offshore)
- All new state should persist via usePersistentState
