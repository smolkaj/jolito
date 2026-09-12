---
name: hindsight-reflection
description: Reflect on a completed implementation before review. Evaluate whether the change is a genuine improvement, what was learned during exploration, and whether starting fresh yields a simpler design. Use before submitting for review or opening a PR; do not use as a substitute for the independent review loop.
---

# Hindsight reflection

Before submitting a PR for review or declaring work ready, pause and reflect honestly on what was built.

Exploration is how we understand the problem space. Often, the first working version reflects the chronological journey of discovery rather than the ideal destination. Now that the solution works and the domain requirements are clear, evaluate the result with full hindsight.

## The core reflection

State your reflection explicitly in dialogue:

1. **In hindsight, would you do it again? Was this actually an improvement?**
   - Step back from the effort invested. Looking at the whole system now, does this change genuinely leave the codebase in a better, clearer, simpler state?
2. **What would you do differently with what you have learned?**
   - Which parts felt natural, and which parts felt contorted or over-engineered to accommodate discoveries made along the way?
   - Knowing the ideal north star now, what would the solution look like if designed from scratch today?

## Decision: Refine or start fresh?

- **Keep and refine:** If the architecture is already direct, minimal, and matches the ideal north star, proceed with confidence to PR preparation and the independent review loop.
- **Start fresh:** If a cleaner, simpler architecture is evident with what you have learned, don't hesitate to throw away the draft and start over.
  - The first pass was not wasted time—it was how the problem was understood.
  - A clean second pass is typically fast, unburdened by false starts, and truer to the north star.
  - Retain the tests and verification criteria developed during the first pass to guide and verify the rewrite.
  - **Apply the restraint check:** Ensure the new pass is genuinely simpler, more direct, and easier to evolve—do not swing to the opposite extreme of speculative abstraction or unnecessary cleverness.
  - Document your reflection briefly in the PR description (e.g., what was learned in the initial exploration and why the clean design was chosen).

Limit this reset to at most one clean restart per task to maintain steady momentum.
