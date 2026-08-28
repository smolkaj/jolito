---
name: independent-pr-review
description: Run a formal pre-merge pull-request review as its author/orchestrator or as a fresh independent read-only reviewer. Use for requested PR reviews and repository-required review loops, not informal code explanation or author self-review.
---

# Review a pull request

Reach a trustworthy decision about one exact PR head. Keep the process small; spend the effort on understanding the change.

Use **Author or orchestrator** when preparing a PR or coordinating its review. Use **Independent reviewer** when assigned a general read-only review, and **Design reviewer** when assigned the dedicated design review required for user-facing changes. Reviewers do not delegate another review from either role.

## Non-negotiables

- An independent reviewer is fresh, has not authored the change, and is strictly read-only. Reviewers may inspect code and trusted CI, but must not modify tracked files or Git/remote state: no edits, commits, pushes, comments, approvals, thread resolution, or merges.
- Give an ordinary reviewer only their assigned role and the PR URL. The description, diff, and repository must provide the rationale and evidence needed to review it. A reviewer asked to arbitrate a challenged blocker must also receive the exact finding and the location of the author's documented rationale.
- Resolve the base and head commit SHAs from the PR before reviewing and confirm neither has changed before reporting a verdict. A verdict applies only to that exact pair.
- Report **blocking** findings separately from **advisory** observations. A finding is blocking when resolving it would materially improve correctness, clarity, simplicity, readability, maintainability, visual coherence, or long-term health. Advisory observations are preferences or polish with no material code-health impact; authors must not dismiss substantive improvements as optional merely because the code works.
- Each concept should have one obvious source of truth and execution path. Treat competing authorities, unsynchronized copies, inconsistent invariants or terminology, and incomplete migrations as blockers.
- When a PR touches user-facing UI, styling, in-product copy, or interactions, it requires a fresh design reviewer focused on [docs/DESIGN.md](../../../docs/DESIGN.md) in addition to the general independent review. Treat material design regressions as blocking findings.
- The author owns the product direction and evaluates every observation on the evidence. They may reject advice that would worsen the whole, but cannot clear a blocking finding by assertion. To challenge a blocker, document the finding, disagreement, and rationale in the PR, then ask a fresh reviewer in the same role to arbitrate that finding on the unchanged head. The reviewer must explicitly rule on the challenged finding and explain the ruling. The blocker is resolved only when that reviewer concludes it does not apply; otherwise change the PR.
- Any change to the PR base or head invalidates prior approval. Repeat the required gates and use fresh reviewers until the current pair has zero blocking findings.
- Never merge without the user's explicit approval.

## Author or orchestrator

1. Make the PR self-documenting. Lead with the big-picture win, contrast before and after, explain the next step toward the north star, and include risks and verification.
2. Before each formal review round, simplify the finished change. Seek reuse, directness, readability, and efficiency; remove needless indirection, duplication, dead code, obsolete paths, and stale or redundant comments. Keep comments that explain a non-obvious reason or invariant. Fix every material issue you find, then run the repository's required gates.
3. Launch a fresh reviewer with the **Independent reviewer** role and the PR URL. For user-facing changes, also launch a fresh reviewer with the **Design reviewer** role and the PR URL. Do not provide other change-specific context or change the branch while review is in progress. For a challenge review, additionally identify the exact challenged finding and where its rationale is documented in the PR.
4. Consolidate findings without hiding disagreements. Resolve every blocker, rerun the gates, update the PR, and start a new review round with fresh reviewers. When challenging a blocker, follow the documented challenge-and-rereview path rather than changing the head.
5. At fixpoint, add a concise PR record containing the base/head SHAs, reviewer identifiers and roles, gates actually run, outcome, and the rationale for any challenged finding that a fresh reviewer determined did not apply.

Churn is free: when a coherent simplification calls for a deep refactor, follow it through every affected file and call site, including files outside the original diff. Diff size, file count, or mechanical effort is not a reason to preserve debt or leave the work incomplete. The standard is a materially simpler, more understandable system—not maximum change, speculative abstraction, or unrelated product behavior.

Do not count author self-review as independent review. Track every blocker until it is resolved or demonstrably no longer applies.

## Independent reviewer

1. Read the PR description, commits, full diff, repository instructions, and the surrounding code or documentation needed to understand the change. Verify claims rather than trusting the narrative. When arbitrating a challenged blocker, also evaluate the documented finding and rationale; address that finding explicitly in the verdict.
2. Review the whole change according to its real risks. Consider correctness, security, data compatibility, failure behavior, needless complexity, duplication, dead code, obsolete paths, misleading or redundant comments, architecture and cognitive cost (especially hidden state, ambient magic, or divergent mechanisms), test and documentation sufficiency, and—when user-facing—accessibility and rendered behavior. Treat material opportunities to make the code clearer and easier to evolve as blockers, even when behavior is correct. Do not manufacture findings to fill categories or block on unrelated pre-existing debt.
3. Verify the relevant required checks from trusted CI. Distinguish results you observed from claims in the PR description. If local execution is necessary, do not execute untrusted PR code outside an isolated, credential-free environment. UI changes require visual inspection; DOM assertions alone are not visual verification.
4. Put findings first, ordered by severity. For each, cite the file and line, explain the concrete consequence, and propose a direction for remediation. Then list open questions and advisory observations. If there are no findings, say so plainly.
5. End with the reviewed base/head SHAs and a verdict: `APPROVED` only when the current head has zero blocking findings; otherwise `CHANGES REQUESTED`.

Stay read-only even if asked to fix an issue discovered during the review. Return it to the author/orchestrator.

## Design reviewer

Apply the independent-review rules above with dedicated attention to the rendered visual, interactive, sensory, and accessible experience. Read [docs/DESIGN.md](../../../docs/DESIGN.md), inspect the change in each relevant state and viewport, and evaluate the whole experience rather than mechanically checking isolated rules.

Design review is required for every change to user-facing UI, styling, in-product copy, or interactions. It does not replace the general independent review. Report material departures from the design principles as blocking findings, while distinguishing deliberate product judgment from implementation drift.
