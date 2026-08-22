# Independent AI review

Ritmo requires a fresh AI reviewer to inspect every pull request independently
from its builder. The enforceable result is an app-owned GitHub check named
`Independent AI Review` on the exact pull-request head commit. Comments,
checkboxes, and the builder's self-report are not merge authority.

## Trust boundary

The workflow uses `pull_request_target`, so GitHub loads the workflow, prompt,
schema, and policy code from the protected base branch. It checks out only the
base revision and fetches the proposed revision as Git objects; it never checks
out or executes proposed code. Pull-request metadata and diffs are explicitly
marked as untrusted evidence.

Codex runs with the OpenAI action's privilege-dropping safety strategy and a
read-only permission profile. Its API key is passed only to that isolated
action. The deterministic policy then verifies the structured result, including
the reviewed base and head SHAs and consistency between blocking findings and
the verdict.

Only after the model and policy finish does the workflow mint a short-lived
token for the reviewer GitHub App. No model or proposed code runs after that
point. The token can create check runs but cannot read secrets, push code,
approve its own changes, or merge pull requests.

The policy fails closed when:

- the model action or any setup step fails;
- output is missing, malformed, or contains unsupported fields;
- the reported base or head SHA differs from the event;
- a path or line range is unsafe or invalid;
- the model verdict contradicts its findings;
- at least one finding is classified as blocking;
- the reviewer app cannot publish the commit-specific check.

## One-time bootstrap

The credentials do not exist in source control. A repository administrator must
perform this once after the workflow is merged:

1. Create a GitHub App named `Ritmo Independent AI Reviewer`. Disable webhooks,
   grant repository metadata read access and checks read/write access only, and
   install it only on `smolkaj/ritmo`.
2. Generate a private key for the app.
3. Create a GitHub Actions environment named `independent-ai-review`. Restrict
   its deployment branches to protected branches.
4. Add environment variable `REVIEWER_APP_ID` and environment secrets
   `REVIEWER_APP_PRIVATE_KEY` and `OPENAI_API_KEY`.
5. Optionally set `CODEX_REVIEW_MODEL`; the workflow's reviewed default is
   `gpt-5.5`.
6. Open a canary pull request with both a known blocking defect and a subsequent
   fix. Confirm that the app-owned check fails and then passes on the respective
   head commits.
7. Add `Independent AI Review` to `main` branch protection, select the reviewer
   GitHub App as the expected source, require branches to be current before
   merging, and retain admin enforcement.

Do not add the required branch check before a successful canary run: GitHub must
first observe the app-owned check, and enabling it prematurely would lock every
pull request. The bootstrap change itself needs a manually initiated review by
a model invocation that did not build it.

## Reviewer contract

The reviewer receives the pull-request title and body, complete base-to-head
diff, trusted repository guidance, immutable commit SHAs, and access to inspect
both revisions. It does not receive the builder's conversation or conclusions.

Blocking findings are limited to concrete bugs, security or data-loss risks,
unmet requirements, broken invariants, material regressions, or missing
verification that makes the change unsafe to ship. Suggestions that do not make
the patch incorrect are advisory and do not block the required check.

Each result records the model, policy hash, workflow run, reviewed SHAs, verdict,
finding counts, and file/line evidence. A push creates a new head SHA, cancels
the stale run, and requires a new app-owned check.

## Operating and updating the reviewer

- Keep the Codex action and CLI pinned; update them in a dedicated pull request.
- Treat prompt, schema, policy, workflow, model, and app-permission changes as
  security-sensitive reviewer changes. The currently deployed reviewer reviews
  proposed changes to its successor.
- Never expose the reviewer app private key as a repository-wide secret. Keep it
  in the protected environment.
- Rotate the app private key and OpenAI credential immediately if a workflow or
  runner exposure is suspected.
- Periodically run seeded bad patches through the reviewer and track blocking
  issue recall, false-positive rate, malformed-output rate, latency, and cost.
- Keep deterministic CI as separate merge authority. AI review supplements
  tests, type checks, dependency review, and static analysis; it does not
  replace them.
