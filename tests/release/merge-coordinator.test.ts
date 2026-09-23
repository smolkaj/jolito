import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sortPRQueue,
  evaluateMainlineSettlement,
  evaluatePRMergeability,
  evaluatePRChecks,
  REQUIRED_RULESET_CHECKS,
  type QueuedPR,
  type PRCheckItem,
} from '../../scripts/merge-coordinator.ts'
import type { WorkflowRun } from '../../scripts/check-main-health.ts'

void test('sortPRQueue orders PRs strictly FIFO by createdAt timestamp', () => {
  const prs: QueuedPR[] = [
    {
      number: 102,
      title: 'feat: second feature',
      createdAt: '2026-09-22T12:00:00Z',
    },
    {
      number: 101,
      title: 'feat: first feature',
      createdAt: '2026-09-22T10:00:00Z',
    },
    {
      number: 103,
      title: 'feat: third feature',
      createdAt: '2026-09-22T14:00:00Z',
    },
  ]

  const sorted = sortPRQueue(prs)
  assert.deepEqual(
    sorted.map((p) => p.number),
    [101, 102, 103],
  )
})

void test('sortPRQueue prioritizes fix-main: hotfixes ahead of older feature PRs', () => {
  const prs: QueuedPR[] = [
    {
      number: 101,
      title: 'feat: old feature',
      createdAt: '2026-09-22T08:00:00Z',
    },
    {
      number: 102,
      title: 'fix-main: critical CI hotfix',
      createdAt: '2026-09-22T10:00:00Z',
    },
    {
      number: 103,
      title: 'feat: another feature',
      createdAt: '2026-09-22T09:00:00Z',
    },
  ]

  const sorted = sortPRQueue(prs)
  assert.deepEqual(
    sorted.map((p) => p.number),
    [102, 101, 103],
  )
})

void test('sortPRQueue orders multiple fix-main: hotfixes among themselves by createdAt', () => {
  const prs: QueuedPR[] = [
    {
      number: 202,
      title: 'fix-main: second hotfix',
      createdAt: '2026-09-22T11:00:00Z',
    },
    {
      number: 100,
      title: 'feat: regular PR',
      createdAt: '2026-09-22T08:00:00Z',
    },
    {
      number: 201,
      title: 'fix-main: first hotfix',
      createdAt: '2026-09-22T10:00:00Z',
    },
  ]

  const sorted = sortPRQueue(prs)
  assert.deepEqual(
    sorted.map((p) => p.number),
    [201, 202, 100],
  )
})

void test('sortPRQueue falls back to PR number if timestamps match exactly', () => {
  const prs: QueuedPR[] = [
    {
      number: 305,
      title: 'feat: PR 305',
      createdAt: '2026-09-22T12:00:00Z',
    },
    {
      number: 302,
      title: 'feat: PR 302',
      createdAt: '2026-09-22T12:00:00Z',
    },
  ]

  const sorted = sortPRQueue(prs)
  assert.deepEqual(
    sorted.map((p) => p.number),
    [302, 305],
  )
})

void test('evaluatePRMergeability rejects conflicting PRs with explanatory feedback', () => {
  const conflictingPr: QueuedPR = {
    number: 999,
    title: 'feat: conflicting changes',
    createdAt: '2026-09-22T10:00:00Z',
    mergeable: 'CONFLICTING',
  }

  const result = evaluatePRMergeability(conflictingPr)
  assert.equal(result.canMerge, false)
  assert.match(result.message ?? '', /git merge conflicts with `main`/)
  assert.match(result.message ?? '', /#999/)
})

void test('evaluatePRMergeability allows clean or mergeable PRs', () => {
  const cleanPr: QueuedPR = {
    number: 101,
    title: 'feat: clean changes',
    createdAt: '2026-09-22T10:00:00Z',
    mergeable: 'MERGEABLE',
  }

  const result = evaluatePRMergeability(cleanPr)
  assert.equal(result.canMerge, true)
  assert.equal(result.message, undefined)
})

void test('evaluatePRChecks requires all ruleset checks and ignores Merge Coordinator', () => {
  const checks: PRCheckItem[] = REQUIRED_RULESET_CHECKS.map((name) => ({
    name,
    state: 'SUCCESS',
    bucket: 'pass',
    workflow: 'CI',
  }))

  // Add the coordinator itself in progress (should be ignored)
  checks.push({
    name: 'Drain merge queue',
    state: 'IN_PROGRESS',
    bucket: 'pending',
    workflow: 'Merge Coordinator',
  })

  const result = evaluatePRChecks(checks)
  assert.equal(result.allPassing, true)
  assert.equal(result.hasFailures, false)
  assert.equal(result.missingRequired.length, 0)
  assert.equal(result.pendingCount, 0)
})

void test('evaluatePRChecks prevents premature landing when downstream gate check is not yet registered', () => {
  // Only 4 of the 5 required checks have finished; Browser smoke tests not registered yet
  const checks: PRCheckItem[] = [
    {
      name: 'Quality gates',
      state: 'SUCCESS',
      bucket: 'pass',
      workflow: 'Quality',
    },
    {
      name: 'Dependency review',
      state: 'SUCCESS',
      bucket: 'pass',
      workflow: 'Quality',
    },
    {
      name: 'CodeQL analysis',
      state: 'SUCCESS',
      bucket: 'pass',
      workflow: 'CodeQL',
    },
    {
      name: 'Xcode iOS compilation gate',
      state: 'SUCCESS',
      bucket: 'pass',
      workflow: 'iOS Native Build',
    },
  ]

  const result = evaluatePRChecks(checks)
  assert.equal(result.allPassing, false)
  assert.equal(result.hasFailures, false)
  assert.deepEqual(result.missingRequired, ['Browser smoke tests'])
  assert.equal(result.pendingCount, 1)
})

void test('evaluatePRChecks catches cancelled and timed out checks as failures', () => {
  const checks: PRCheckItem[] = [
    {
      name: 'Quality gates',
      state: 'CANCELLED',
      bucket: 'cancel',
      workflow: 'Quality',
    },
    {
      name: 'Browser smoke tests',
      state: 'SUCCESS',
      bucket: 'pass',
      workflow: 'Quality',
    },
  ]

  const result = evaluatePRChecks(checks)
  assert.equal(result.allPassing, false)
  assert.equal(result.hasFailures, true)
  assert.equal(result.failures.length, 1)
  assert.equal(result.failures[0]?.name, 'Quality gates')
})

void test('evaluateMainlineSettlement detects when mainline CI runs are missing for new commit', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: null,
      status: 'in_progress',
      url: 'https://example.com/1',
      headSha: 'target-new-sha',
    },
  ]

  const result = evaluateMainlineSettlement(runs, 'target-new-sha')
  assert.equal(result.settled, false)
  assert.deepEqual(result.missingWorkflows, ['iOS Native Build', 'CodeQL'])
})

void test('evaluateMainlineSettlement detects in-progress runs on target commit', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/1',
      headSha: 'target-sha',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: null,
      status: 'in_progress',
      url: 'https://example.com/2',
      headSha: 'target-sha',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/3',
      headSha: 'target-sha',
    },
  ]

  const result = evaluateMainlineSettlement(runs, 'target-sha')
  assert.equal(result.settled, false)
  assert.equal(result.missingWorkflows.length, 0)
  assert.equal(result.inProgress.length, 1)
  assert.equal(result.inProgress[0]?.workflowName, 'iOS Native Build')
})

void test('evaluateMainlineSettlement confirms settlement when all core runs exist and complete', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/1',
      headSha: 'target-sha',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/2',
      headSha: 'target-sha',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/3',
      headSha: 'target-sha',
    },
  ]

  const result = evaluateMainlineSettlement(runs, 'target-sha')
  assert.equal(result.settled, true)
  assert.equal(result.inProgress.length, 0)
  assert.equal(result.missingWorkflows.length, 0)
})

void test('evaluateMainlineSettlement ignores completed runs from older commits', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/old-quality',
      headSha: 'older-commit',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/old-ios',
      headSha: 'older-commit',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/old-codeql',
      headSha: 'older-commit',
    },
  ]

  const result = evaluateMainlineSettlement(runs, 'target-new-sha')
  assert.equal(result.settled, false)
  assert.deepEqual(result.missingWorkflows, [
    'Quality',
    'iOS Native Build',
    'CodeQL',
  ])
})
