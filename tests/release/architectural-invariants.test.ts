import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

export interface InvariantViolation {
  filePath: string
  line: number
  column: number
  rule:
    | 'INVARIANT_8_IDLE_ACTIVITY'
    | 'INVARIANT_5_BOUNDARY_VALIDATION'
    | 'INVARIANT_4_FAIL_LOUDLY'
  message: string
  snippet: string
}

/**
 * Files approved for single-frame layout or lifecycle orchestration.
 * Invariant 8 mandates zero idle activity, prohibiting ambient polling loops or unthrottled frame loops.
 */
export const APPROVED_RAF_FILES = new Set([
  'src/infrastructure/browser/keyboard-avoidance.ts',
])

export const APPROVED_INTERVAL_FILES = new Set<string>([])

export function getProductionSourceFiles(dir: string, baseDir = dir): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test') {
        continue
      }
      results.push(...getProductionSourceFiles(fullPath, baseDir))
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(relPath)
    }
  }

  return results.sort()
}

function resolveSourceFile(
  filePath: string,
  source: string | ts.SourceFile,
): ts.SourceFile {
  return typeof source === 'string'
    ? ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
    : source
}

function unwrapExpression(node: ts.Node): ts.Node {
  let curr = node
  while (
    ts.isParenthesizedExpression(curr) ||
    ts.isAwaitExpression(curr) ||
    ts.isAsExpression(curr) ||
    ts.isTypeAssertionExpression(curr)
  ) {
    curr = curr.expression
  }
  return curr
}

function isJsonParseOrFetchJson(node: ts.Node, sf: ts.SourceFile): boolean {
  const unwrapped = unwrapExpression(node)
  if (!ts.isCallExpression(unwrapped)) {
    return false
  }

  const expr = unwrapped.expression
  const exprText = expr.getText(sf)

  if (exprText === 'JSON.parse' || exprText.endsWith('.JSON.parse')) {
    return true
  }

  if (exprText.endsWith('.json')) {
    return true
  }

  // Matches .json().catch(...)
  if (exprText.endsWith('.catch') && ts.isPropertyAccessExpression(expr)) {
    const callee = unwrapExpression(expr.expression)
    if (
      ts.isCallExpression(callee) &&
      callee.expression.getText(sf).endsWith('.json')
    ) {
      return true
    }
  }

  return false
}

function isPermittedBoundaryType(typeText: string): boolean {
  const normalized = typeText.trim()
  return (
    normalized === 'unknown' ||
    normalized === 'any' ||
    normalized === 'Promise<unknown>' ||
    normalized === 'Promise<any>'
  )
}

/**
 * Scans an AST for Invariant 8 violations:
 * - Unapproved setInterval or requestAnimationFrame calls.
 */
export function scanIdleActivity(
  filePath: string,
  source: string | ts.SourceFile,
): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const sf = resolveSourceFile(filePath, source)
  const normalizedPath = filePath.replace(/\\/g, '/')

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      let calleeName = ''
      if (ts.isIdentifier(node.expression)) {
        calleeName = node.expression.text
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        calleeName = node.expression.name.text
      }

      if (calleeName === 'setInterval') {
        const isApproved = Array.from(APPROVED_INTERVAL_FILES).some((p) =>
          normalizedPath.endsWith(p),
        )
        if (!isApproved) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.getStart(),
          )
          violations.push({
            filePath,
            line: line + 1,
            column: character + 1,
            rule: 'INVARIANT_8_IDLE_ACTIVITY',
            message: `Prohibited 'setInterval' call detected. Invariant 8 prohibits ambient polling loops during idle.`,
            snippet: node.getText(sf),
          })
        }
      }

      if (calleeName === 'requestAnimationFrame') {
        const isApproved = Array.from(APPROVED_RAF_FILES).some((p) =>
          normalizedPath.endsWith(p),
        )
        if (!isApproved) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.getStart(),
          )
          violations.push({
            filePath,
            line: line + 1,
            column: character + 1,
            rule: 'INVARIANT_8_IDLE_ACTIVITY',
            message: `Prohibited 'requestAnimationFrame' call detected outside approved lifecycle contracts. Invariant 8 prohibits unthrottled frame activity.`,
            snippet: node.getText(sf),
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return violations
}

/**
 * Scans an AST for Invariant 5 violations:
 * - Prohibits unsafe raw `as <Type>` casts on untrusted JSON boundaries without Zod validation.
 */
export function scanBoundaryCasts(
  filePath: string,
  source: string | ts.SourceFile,
): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const sf = resolveSourceFile(filePath, source)

  function visit(node: ts.Node): void {
    // Check `expr as TargetType`
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (isJsonParseOrFetchJson(node.expression, sf)) {
        const typeText = node.type.getText(sf)
        if (!isPermittedBoundaryType(typeText)) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.getStart(),
          )
          violations.push({
            filePath,
            line: line + 1,
            column: character + 1,
            rule: 'INVARIANT_5_BOUNDARY_VALIDATION',
            message: `Unsafe raw cast 'as ${typeText}' on parsed JSON. Invariant 5 mandates runtime Zod validation for external and persistent boundaries.`,
            snippet: node.getText(sf),
          })
        }
      }
    }

    // Check `const x: TargetType = JSON.parse(...)`
    if (ts.isVariableDeclaration(node) && node.initializer && node.type) {
      if (isJsonParseOrFetchJson(node.initializer, sf)) {
        const typeText = node.type.getText(sf)
        if (!isPermittedBoundaryType(typeText)) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.getStart(),
          )
          violations.push({
            filePath,
            line: line + 1,
            column: character + 1,
            rule: 'INVARIANT_5_BOUNDARY_VALIDATION',
            message: `Unsafe type annotation ': ${typeText}' on parsed JSON. Invariant 5 mandates runtime Zod validation for external and persistent boundaries.`,
            snippet: node.getText(sf),
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return violations
}

/**
 * Scans an AST for Invariant 4 violations:
 * - Prohibits empty catch blocks that swallow exceptions silently without structured reporting or documented safe fallback rationale.
 */
export function scanSilentCatch(
  filePath: string,
  source: string | ts.SourceFile,
): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const sf = resolveSourceFile(filePath, source)

  function visit(node: ts.Node): void {
    if (ts.isCatchClause(node)) {
      if (node.block.statements.length === 0) {
        // Block has no executable statements
        const blockText = node.block.getText(sf)
        // Extract comment text within the braces
        const innerText = blockText.slice(1, -1).trim()

        const hasSubstantiveRationale =
          innerText.length >= 8 &&
          !/^(\/\/|\/\*)\s*(ignore|fallback|error)\s*(\*\/)?$/i.test(innerText)

        if (!hasSubstantiveRationale) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.getStart(),
          )
          violations.push({
            filePath,
            line: line + 1,
            column: character + 1,
            rule: 'INVARIANT_4_FAIL_LOUDLY',
            message: `Empty catch block swallows exceptions silently without structured handling or documented safe fallback rationale. Invariant 4 prohibits silent failures.`,
            snippet: node.getText(sf).replace(/\s+/g, ' '),
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return violations
}

/**
 * Runs all invariant scans on a file with a single AST parse.
 */
export function scanArchitecturalInvariants(
  filePath: string,
  source: string | ts.SourceFile,
): InvariantViolation[] {
  const sf = resolveSourceFile(filePath, source)
  return [
    ...scanIdleActivity(filePath, sf),
    ...scanBoundaryCasts(filePath, sf),
    ...scanSilentCatch(filePath, sf),
  ]
}

void describe('Architectural Invariants Static AST Contracts', () => {
  void describe('Invariant 8: Zero Idle Activity & Timer Suspension Discipline', () => {
    void it('flags unapproved setInterval calls', () => {
      const code = `
        export function startPolling() {
          setInterval(() => { refresh(); }, 1000);
        }
      `
      const violations = scanIdleActivity('src/ui/Component.tsx', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_8_IDLE_ACTIVITY')
      assert.match(violations[0]?.message ?? '', /setInterval/)
    })

    void it('flags unapproved window.setInterval calls', () => {
      const code = `
        export function init() {
          window.setInterval(() => {}, 500);
        }
      `
      const violations = scanIdleActivity('src/domain/service.ts', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_8_IDLE_ACTIVITY')
    })

    void it('flags unapproved requestAnimationFrame loops', () => {
      const code = `
        export function animate() {
          requestAnimationFrame(animate);
        }
      `
      const violations = scanIdleActivity('src/ui/Animation.tsx', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_8_IDLE_ACTIVITY')
      assert.match(violations[0]?.message ?? '', /requestAnimationFrame/)
    })

    void it('permits approved single-frame scheduling in keyboard-avoidance.ts', () => {
      const code = `
        win.requestAnimationFrame(() => {
          if (!isMounted) return;
          scroll();
        });
      `
      const violations = scanIdleActivity(
        'src/infrastructure/browser/keyboard-avoidance.ts',
        code,
      )
      assert.strictEqual(violations.length, 0)
    })
  })

  void describe('Invariant 5: Validate Boundaries with Zod', () => {
    void it('flags raw "as <Type>" cast on JSON.parse', () => {
      const code = `
        const data = JSON.parse(rawText) as UserProfile;
      `
      const violations = scanBoundaryCasts(
        'src/infrastructure/storage.ts',
        code,
      )
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_5_BOUNDARY_VALIDATION')
      assert.match(violations[0]?.message ?? '', /UserProfile/)
    })

    void it('flags raw "as <Type>" cast on response.json()', () => {
      const code = `
        const payload = (await res.json()) as ApiResponse;
      `
      const violations = scanBoundaryCasts('src/infrastructure/api.ts', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_5_BOUNDARY_VALIDATION')
      assert.match(violations[0]?.message ?? '', /ApiResponse/)
    })

    void it('flags chained cast bypass (as unknown as TargetType)', () => {
      const code = `
        const data = (JSON.parse(rawText) as unknown) as UserProfile;
      `
      const violations = scanBoundaryCasts(
        'src/infrastructure/storage.ts',
        code,
      )
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_5_BOUNDARY_VALIDATION')
      assert.match(violations[0]?.message ?? '', /UserProfile/)
    })

    void it('flags raw type assertion prefix <Type>JSON.parse(...)', () => {
      const code = `
        const data = <UserProfile>JSON.parse(rawText);
      `
      const violations = scanBoundaryCasts(
        'src/infrastructure/storage.ts',
        code,
      )
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_5_BOUNDARY_VALIDATION')
    })

    void it('flags typed variable declaration on JSON.parse(...)', () => {
      const code = `
        const data: UserProfile = JSON.parse(rawText);
      `
      const violations = scanBoundaryCasts(
        'src/infrastructure/storage.ts',
        code,
      )
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_5_BOUNDARY_VALIDATION')
    })

    void it('allows parsing as unknown followed by Zod schema validation', () => {
      const code = `
        const parsed: unknown = JSON.parse(rawText);
        const result = userProfileSchema.safeParse(parsed);
      `
      const violations = scanBoundaryCasts(
        'src/infrastructure/storage.ts',
        code,
      )
      assert.strictEqual(violations.length, 0)
    })
  })

  void describe('Invariant 4: Never Fail Silently', () => {
    void it('flags completely empty catch block without comment or statement', () => {
      const code = `
        try {
          doWork();
        } catch {}
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_4_FAIL_LOUDLY')
      assert.match(violations[0]?.message ?? '', /swallows exceptions silently/)
    })

    void it('flags empty catch block with binding but no statement or comment', () => {
      const code = `
        try {
          doWork();
        } catch (err) {}
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_4_FAIL_LOUDLY')
    })

    void it('flags catch block with trivial uninformative comment', () => {
      const code = `
        try {
          doWork();
        } catch {
          // ignore
        }
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 1)
      assert.strictEqual(violations[0]?.rule, 'INVARIANT_4_FAIL_LOUDLY')
    })

    void it('allows catch block with documented safe fallback rationale', () => {
      const code = `
        try {
          elem.releasePointerCapture(id);
        } catch {
          // Safe fallback when pointer capture unsupported or already released
        }
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 0)
    })

    void it('allows catch block with structured error logging', () => {
      const code = `
        try {
          doWork();
        } catch (err) {
          console.error('[Operation] Failed cleanly:', err);
        }
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 0)
    })

    void it('allows catch block with fallback return dispatch', () => {
      const code = `
        try {
          return compute();
        } catch {
          return null;
        }
      `
      const violations = scanSilentCatch('src/ui/View.tsx', code)
      assert.strictEqual(violations.length, 0)
    })
  })

  void describe('Repository-wide Source Verification', () => {
    void it('verifies all production TypeScript source files comply with repository invariants', () => {
      const srcDir = path.resolve(process.cwd(), 'src')
      const files = getProductionSourceFiles(srcDir, process.cwd())
      assert.ok(
        files.length > 50,
        `Expected at least 50 source files, found ${files.length}`,
      )

      const allViolations: InvariantViolation[] = []
      const startTime = performance.now()

      for (const relPath of files) {
        const fullPath = path.resolve(process.cwd(), relPath)
        const content = fs.readFileSync(fullPath, 'utf8')
        const sf = ts.createSourceFile(
          relPath,
          content,
          ts.ScriptTarget.Latest,
          true,
        )

        allViolations.push(...scanArchitecturalInvariants(relPath, sf))
      }

      const elapsedMs = performance.now() - startTime

      if (allViolations.length > 0) {
        const formatted = allViolations
          .map(
            (v) =>
              `  [${v.rule}] ${v.filePath}:${v.line}:${v.column}\n    ${v.message}\n    Snippet: ${v.snippet}`,
          )
          .join('\n\n')
        assert.fail(
          `Found ${allViolations.length} architectural invariant violations:\n\n${formatted}`,
        )
      }

      assert.strictEqual(
        allViolations.length,
        0,
        'Zero architectural invariant violations expected',
      )
      // Safety watchdog solely to prevent infinite loops / deadlocks on slow virtualized runners
      assert.ok(
        elapsedMs < 15000,
        `Scan took ${elapsedMs.toFixed(1)}ms, expected execution under watchdog limit (< 15000ms)`,
      )
    })
  })
})
