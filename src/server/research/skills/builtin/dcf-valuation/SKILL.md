---
name: dcf-valuation
description: Value a company using discounted cash flow analysis
---

## DCF Valuation Skill

When asked to value a company using DCF:

1. Retrieve the last 3 years of free cash flow (revenue - capex - operating expenses) from financials.
2. Estimate a growth rate from analyst estimates or historical FCF CAGR. Use conservative assumptions.
3. Apply a discount rate (WACC): use 10% as a default for US large-cap equities; adjust up for small-cap or high-debt companies.
4. Project FCF for 5 years, then compute a terminal value using a 2.5% perpetuity growth rate.
5. Discount all cash flows back to present value. Sum them for intrinsic value.
6. Divide by diluted shares outstanding to get per-share intrinsic value.
7. Compare to current price and state the margin of safety or premium.

Always cite the specific numbers you used and their sources.
