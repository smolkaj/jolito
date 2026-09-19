---
name: hindsight-reflection
description: Evaluate a working implementation against a clean-slate design to eliminate exploratory accretion, rebuild cleanly, or drop the direction before review.
---

# Hindsight reflection

The first working implementation is often an exploratory draft (a spike) shaped by the journey of debugging: compensatory layering, patch-on-patch overrides, and structural compromises made to get tests to pass.

Once tests are passing, you possess full knowledge of the problem that was missing at the start. Do not fall into the sunk-cost trap: passing tests are your **safety ratchet**, not a reason to preserve an accreted draft. Because the tests already capture the discovered requirements and edge cases, discarding draft implementation files carries zero risk of regression.

Before submitting a PR for review, execute this protocol autonomously and post the evaluation in dialogue.

## 1. Extracted Knowledge (The Discovery)

Name the constraints, edge cases, or requirements uncovered during implementation that were not obvious at the outset.

## 2. Greenfield Design (The Clean Slate)

Knowing all discovered constraints upfront, sketch the simplest, most direct architecture you would build from a blank slate. What is the unified model or representation that makes special-casing and compensatory glue unnecessary?

## 3. Delta Check & Autonomous Decision

Compare the working draft against the greenfield design, auditing for exploratory accretion:

- **Compensatory layering vs. unified model:** Are overrides, extra branches, or wrappers stacked to handle newly discovered cases instead of finding the underlying model that makes those cases natural?
- **Sediment of the journey:** Does the diff reflect the chronological order of bug fixes and patches rather than an intentional, coherent design?
- **Downstream symptom relief:** Does the change work around awkward upstream structures from the outside rather than fixing the contract or structure at the root?
- **Inverted signal-to-noise:** Do glue, overrides, special cases, and coordination dominate the core intent?

### Decision

- **Proceed:** The draft already matches the greenfield design (clean, direct, unified). Proceed to review.
- **Rebuild cleanly:** The draft exhibits exploratory accretion or structural divergence. Keep the newly written tests (the safety ratchet), revert the draft implementation files (`git restore <files>`), and implement the clean greenfield design in one direct pass. Run the repository gates to verify.
- **Drop it:** In hindsight, the change introduces more complexity than the problem warrants, or the premise was flawed. Recommend dropping the PR or direction entirely.
