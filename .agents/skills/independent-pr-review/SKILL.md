---
name: independent-pr-review
description: Run a formal pre-merge pull-request review as its author/orchestrator or as a fresh independent read-only reviewer. Use for requested PR reviews and repository-required review loops, not informal code explanation or author self-review.
---

# Review a pull request

Reach a trustworthy decision about one exact PR head. Keep the process small; spend the effort on understanding the change.

Use **Author or orchestrator** when preparing a PR or coordinating its review. Use **Independent reviewer** when assigned a read-only review; do not delegate another review from that role.

## Non-negotiables

- An independent reviewer is fresh, has not authored the change, and is strictly read-only. Reviewers may inspect code and trusted CI, but must not modify tracked files or Git/remote state: no edits, commits, pushes, comments, approvals, thread resolution, or merges.
- Give each reviewer only the PR URL. The description, diff, and repository must provide the rationale and evidence needed to review it.
- Resolve the base and head commit SHAs from the PR before reviewing and confirm the live head is unchanged before reporting a verdict. A verdict applies only to that head.
- Report **blocking** findings separately from **advisory** observations. Blocking findings are defects, failed requirements or gates, or missing evidence that makes merging unsafe. Advisory observations are genuinely optional.
- Any change to the PR head invalidates prior approval. Repeat the required gates and use fresh reviewers until the current head has zero blocking findings.
- Never merge without the user's explicit approval.

## Author or orchestrator

1. Make the PR self-documenting. Lead with the big-picture win, contrast before and after, explain the next step toward the north star, and include risks and verification.
2. Before formal review, run the repository's required gates and take one deliberate hindsight pass: knowing the finished diff, would you choose a simpler design? Change it only when the result is materially clearer; avoid refactoring theatre.
3. Launch a fresh independent reviewer and give it only the PR URL. Do not change the branch while review is in progress. Add parallel reviewers only when the actual risk warrants another perspective; do not assign a fixed quota or divide responsibility for the whole change.
4. Consolidate their findings without hiding disagreements. Decide each observation on the evidence; resolve every blocker, rerun the gates, update the PR, and start a new review round with fresh instances.
5. At fixpoint, add a concise PR record containing the base/head SHAs, reviewer identifiers, gates actually run, and outcome.

Do not count author self-review as independent review. Track every blocker until it is resolved or demonstrably no longer applies.

## Independent reviewer

1. Read the PR description, commits, full diff, repository instructions, and the surrounding code or documentation needed to understand the change. Verify claims rather than trusting the narrative.
2. Review the whole change according to its real risks. Consider correctness, security, data compatibility, failure behavior, architecture and cognitive cost (especially hidden state, ambient magic, or divergent mechanisms), test and documentation sufficiency, and—when user-facing—accessibility and rendered behavior. Do not manufacture findings to fill categories.
3. Verify the relevant required checks from trusted CI. Distinguish results you observed from claims in the PR description. If local execution is necessary, do not execute untrusted PR code outside an isolated, credential-free environment. UI changes require visual inspection; DOM assertions alone are not visual verification.
4. Put findings first, ordered by severity. For each, cite the file and line, explain the concrete consequence, and propose a direction for remediation. Then list open questions and advisory observations. If there are no findings, say so plainly.
5. End with the reviewed base/head SHAs and a verdict: `APPROVED` only when the current head has zero blocking findings; otherwise `CHANGES REQUESTED`.

Stay read-only even if asked to fix an issue discovered during the review. Return it to the author/orchestrator.
