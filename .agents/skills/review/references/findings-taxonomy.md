# Universal Review Findings Taxonomy & Severity Guide

Every issue reported during a review must be categorized into one of two tiers: **Blocking** or **Advisory**.

---

## 🛑 Blocking Issues (Must Be 0 to Merge)

A blocking issue represents any defect, invariant violation, or quality gate failure that threatens software correctness, maintainability, accessibility, or security. The author must resolve all blocking issues before the PR can be approved.

### Criteria for Blocking Issues

1. **Automated Quality Gate Failure:**
   - Any failure in formatting, linting, typechecking, unit/integration/E2E test suites, build compilation, or security dependency audits.

2. **Correctness & Logic Defects:**
   - State synchronization bugs, race conditions, memory leaks, unhandled promise rejections.
   - Algorithmic errors, incorrect calculations, or broken edge-case handling.

3. **Engineering Invariant Violations:**
   - **Silent Failures:** Swallowing errors, returning fallback values that hide failures, or missing structured error handling.
   - **Boundary Validation:** Ingesting external or persisted payloads without runtime schema validation.
   - **Data Migrations:** Changing persistent data representations without an explicit, tested migration path.
   - **Accessibility:** Breaking keyboard navigation, omitting accessible names/labels, or introducing WCAG AA violations.

4. **Architecture & Boundary Violations:**
   - Core domain logic depending directly on UI or concrete infrastructure modules.
   - UI code parsing raw persistence layers or directly invoking third-party SDKs without application ports.

5. **Ambient Magic & Untestable Coupling:**
   - Global mutable singletons, invisible runtime monkey-patching, or untestable hidden background state.

6. **Missing Tests or Documentation:**
   - Adding new application workflows or complex logic without automated tests.
   - Behavioral, configuration, or architectural changes without updating documentation.

---

## 💡 Advisory Observations (Non-Blocking)

Advisory observations are optional recommendations for code polish, minor readability enhancements, or future follow-ups. They do not block approval.

### Examples of Advisory Observations

- Suggesting a slightly clearer local variable name or comment clarification.
- Minor styling polish that does not affect accessibility or layout stability.
- Proposing a non-critical refactoring or performance optimization for future iterations.
