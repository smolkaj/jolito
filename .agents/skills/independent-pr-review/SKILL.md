---
name: independent-pr-review
description: Run a formal pre-merge pull-request review as its author/orchestrator or as a fresh independent read-only reviewer. Use for requested PR reviews and repository-required review loops, not informal code explanation or author self-review.
---

# Review a pull request

Reach a trustworthy decision about one exact PR head. Keep the process small; spend the effort on understanding the change.

Use **Author or orchestrator** when preparing a PR or coordinating its review. Use **Independent reviewer** (or specialized **Design reviewer**) when assigned a read-only review; do not delegate another review from that role.

## Non-negotiables

- An independent reviewer is fresh, has not authored the change, and is strictly read-only. Reviewers may inspect code and trusted CI, but must not modify tracked files or Git/remote state: no edits, commits, pushes, comments, approvals, thread resolution, or merges.
- Give each reviewer only the PR URL. The description, diff, and repository must provide the rationale and evidence needed to review it.
- Resolve the base and head commit SHAs from the PR before reviewing and confirm neither has changed before reporting a verdict. A verdict applies only to that exact pair.
- Report **blocking** findings separately from **advisory** observations. A finding is blocking when resolving it would materially improve correctness, clarity, simplicity, readability, maintainability, visual coherence, or long-term health. Advisory observations are preferences or polish with no material code-health impact.
- Each concept should have one obvious source of truth and execution path. Treat competing authorities, unsynchronized copies, inconsistent invariants or terminology, and incomplete migrations as blockers.
- When a PR touches user-facing UI, styling, copy, or interactions, reviewers must evaluate the change against [docs/DESIGN.md](../../../docs/DESIGN.md). Treat design regressions (data-spilling, nested boxes, popup spawning, inconsistent styling) as blocking findings.
- **Orchestrator final say:** The author/orchestrator retains executive authority over the PR. They may overrule reviewer comments or blocking findings if they provide a strong, documented rationale in the PR audit record.
- Any change to the PR base or head invalidates prior approval. Repeat the required gates and use fresh reviewers until the current pair is approved (or blockers are formally overruled with strong rationale).
- Never merge without the user's explicit approval.

## Author or orchestrator

1. Make the PR self-documenting. Lead with the big-picture win, contrast before and after, explain the next step toward the north star, and include risks and verification.
2. Before each formal review round, simplify the finished change. Seek reuse, directness, readability, and efficiency; remove needless indirection, duplication, dead code, obsolete paths, and stale or redundant comments. Keep comments that explain a non-obvious reason or invariant. Fix every material issue you find, then run the repository's required gates.
3. Launch a fresh independent reviewer and give it only the PR URL. For user-facing UI changes, launch a dedicated **Design Reviewer** subagent focused specifically on [docs/DESIGN.md](../../../docs/DESIGN.md) to prevent engineering concerns from cannibalizing aesthetic focus. Do not change the branch while review is in progress.
4. Consolidate findings without hiding disagreements. Decide each observation on the evidence; resolve every blocker (or explicitly document the strong rationale for overruling it), rerun the gates, update the PR, and verify readiness.
5. At fixpoint, add a concise PR record containing the base/head SHAs, reviewer identifiers, gates actually run, and outcome (including any overruled items and their rationale).

Churn is free: when a coherent simplification calls for a deep refactor, follow it through every affected file and call site, including files outside the original diff. Diff size, file count, or mechanical effort is not a reason to preserve debt or leave the work incomplete. The standard is a materially simpler, more understandable system—not maximum change, speculative abstraction, or unrelated product behavior.

Do not count author self-review as independent review. Track every blocker until it is resolved, demonstrably no longer applies, or is formally overruled with documented rationale.

## Independent reviewer

1. Read the PR description, commits, full diff, repository instructions, and the surrounding code or documentation needed to understand the change. Verify claims rather than trusting the narrative.
2. Review the whole change according to its real risks. Consider correctness, security, data compatibility, failure behavior, needless complexity, duplication, dead code, obsolete paths, misleading or redundant comments, architecture and cognitive cost (especially hidden state, ambient magic, or divergent mechanisms), test and documentation sufficiency, and—when user-facing—accessibility, rendered behavior, and adherence to [docs/DESIGN.md](../../../docs/DESIGN.md). Treat material opportunities to make the code clearer, simpler, and visually coherent as blockers, even when behavior is correct. Do not manufacture findings to fill categories or block on unrelated pre-existing debt.
3. Verify the relevant required checks from trusted CI. Distinguish results you observed from claims in the PR description. If local execution is necessary, do not execute untrusted PR code outside an isolated, credential-free environment. UI changes require visual inspection against [docs/DESIGN.md](../../../docs/DESIGN.md); DOM assertions alone are not visual verification.
4. Put findings first, ordered by severity. For each, cite the file and line, explain the concrete consequence, and propose a direction for remediation. Then list open questions and advisory observations. If there are no findings, say so plainly.
5. End with the reviewed base/head SHAs and a verdict: `APPROVED` only when the current head has zero blocking findings; otherwise `CHANGES REQUESTED`.

Stay read-only even if asked to fix an issue discovered during the review. Return it to the author/orchestrator.

## Design reviewer (for user-facing UI changes)

When assigned a design review for a UI-touching PR, inspect the visual, interactive, and sensory experience against [docs/DESIGN.md](../../../docs/DESIGN.md):

- **Subtractive test:** Can any container frame, badge, helper text, or count be eliminated to simplify the experience?
- **Action purity:** Are buttons pure verbs (`Practice`, `Manage deck`) without data-spilling or parenthetical counts?
- **De-framing:** Is hierarchy established through whitespace and subtle surface tints (`--paper`, `--card`) rather than nested border boxes?
- **Spatial continuity:** Do state changes morph in place without spawning detached modals or toast alerts?
- **Subtractive copy:** Is copy punchy (1–3 words), calm, and unpretentious (`¡Hecho!`), with secondary aids tucked into tooltips?
- **Ambient flow:** Are focus states free of in-flight scorecards and counters, relying on quiet peripheral cues (3px hairline progress)?
- **Human agency:** Does automation assist without presuming to overwrite personal user note fields?
- **Visual coherence:** Do corner radii (`20px` / `16px` containers, `999px` pills), typography, and 3px 2D hard shadows match canonical tokens without ad-hoc styling?
