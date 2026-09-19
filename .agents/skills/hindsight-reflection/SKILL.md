---
name: hindsight-reflection
description: Evaluate a working implementation against a clean-slate design to eliminate exploratory accretion, rebuild cleanly, or drop the direction before review.
---

# Hindsight reflection

The first working implementation is often an exploratory draft (a spike) shaped by the journey of debugging: compensatory layering, patch-on-patch overrides, and structural compromises made to get tests to pass.

Once tests are passing, you possess full knowledge of the problem that was missing at the start. Do not fall into the sunk-cost trap: passing tests are your **safety ratchet**, not a reason to preserve an accreted draft. Because the tests already capture the discovered requirements and edge cases, discarding draft implementation files carries zero risk of regression.

At the completion of an implementation, execute this protocol, post the evaluation in dialogue, and yield the turn.

## 1. Discoveries & Learnings

Name what was learned during implementation that was not obvious at the outset (e.g. unexpected interactions, domain nuances, or cleaner conceptual models).

## 2. Greenfield Design (The Clean Slate)

With the benefit of hindsight and everything learned, sketch the simplest, most direct architecture you would build from a blank slate. What is the unified model or representation that makes special-casing and compensatory glue unnecessary?

## 3. Delta Check & Recommended Decision

Compare the working draft against the greenfield design, auditing for exploratory accretion:

- **Compensatory layering vs. unified model:** Are overrides, extra branches, or wrappers stacked to handle newly discovered cases instead of finding the underlying model that makes those cases natural?
- **Sediment of the journey:** Does the diff reflect the chronological order of bug fixes and patches rather than an intentional, coherent design?
- **Downstream symptom relief:** Does the change work around awkward upstream structures from the outside rather than fixing the contract or structure at the root?
- **Inverted signal-to-noise:** Do glue, overrides, special cases, and coordination dominate the core intent?

### Recommendation

1. **Rebuild cleanly:** (Expected for non-trivial exploratory work). The draft exhibits exploratory accretion, journey sediment, or structural divergence. Outline the greenfield plan in dialogue, recommend rebuilding cleanly, and yield the turn. Upon user confirmation, keep the newly written tests (the safety ratchet), revert the draft implementation files (`git restore <files>`), and implement the clean greenfield design in one direct pass.
2. **Drop it:** In hindsight, the change introduces more complexity than the problem warrants, or the premise was flawed. Recommend dropping the PR or direction entirely, and yield the turn.
3. **Proceed:** (High bar). Choose this only if the draft already matches the greenfield design with zero compensatory layering or journey sediment. Open the PR, post your recommendation, launch the review loop in parallel, and yield the turn.
