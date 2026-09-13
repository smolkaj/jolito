---
name: hindsight-reflection
description: Reflect on a completed implementation before review to evaluate if it was an actual improvement, if starting fresh yields a simpler design, or if the direction should be dropped entirely.
---

# Hindsight reflection

Before review, answer in dialogue:

> _In hindsight, would you do it again? Was this actually an improvement?_

- **Proceed:** If the change is a genuine improvement and matches the north star, proceed to review.
- **Rebuild cleanly:** If with what you learned you would design it differently, keep the tests, discard the draft, and rebuild cleanly (at most once). Apply the restraint check: simpler and more direct, not more clever.
- **Drop it:** If in hindsight the change is not a genuine improvement, recommend dropping the PR or direction entirely.
