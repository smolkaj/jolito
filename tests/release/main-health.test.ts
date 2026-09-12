import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateMainHealth,
  type WorkflowRun,
  type OpenPullRequest,
} from '../../scripts/check-main-health.ts'

void test('evaluates mainline as healthy when all core workflows succeed', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/1',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/3',
    },
  ]

  const result = evaluateMainHealth(runs)
  assert.equal(result.healthy, true)
  assert.match(result.message, /healthy/)
})

void test('evaluates mainline as unhealthy when a core workflow fails', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/1',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'failure',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/3',
    },
  ]

  const result = evaluateMainHealth(runs)
  assert.equal(result.healthy, false)
  const failure = result.failures?.[0]
  assert.ok(failure)
  assert.equal(failure.workflowName, 'iOS Native Build')
  assert.match(result.message, /iOS Native Build/)
  assert.match(result.message, /abc1234/)
})

void test('ignores in-progress runs and evaluates the latest completed run', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: '',
      status: 'in_progress',
      headSha: 'def5678',
      url: 'https://github.com/smolkaj/jolito/actions/runs/10',
    },
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/1',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/3',
    },
  ]

  const result = evaluateMainHealth(runs)
  assert.equal(result.healthy, true)
})

void test('allows canonical fix-main: title prefix to acquire mutex and bypass check', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'iOS Native Build',
      conclusion: 'failure',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
  ]

  const openPrs: OpenPullRequest[] = [
    {
      number: 100,
      title: 'fix-main: restore simulator timeout',
      createdAt: '2026-09-12T01:00:00Z',
    },
  ]

  const result = evaluateMainHealth(runs, {
    prTitle: 'fix-main: restore simulator timeout',
    prNumber: 100,
    openPrs,
  })
  assert.equal(result.healthy, true)
  assert.equal(result.hotfixBypass, true)
  assert.match(result.message, /mutex lock/)
})

void test('rejects non-canonical bypass attempts when mainline is failing', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'iOS Native Build',
      conclusion: 'failure',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
  ]

  // Titles that do not start with canonical 'fix-main:' are rejected
  const nonCanonical1 = evaluateMainHealth(runs, {
    prTitle: 'hotfix: broken simulator',
  })
  assert.equal(nonCanonical1.healthy, false)

  const nonCanonical2 = evaluateMainHealth(runs, {
    prTitle: 'fix(ci): [fix-main] restore simulator',
  })
  assert.equal(nonCanonical2.healthy, false)
})

void test('enforces mechanical mutex when multiple fix-main PRs compete', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'iOS Native Build',
      conclusion: 'failure',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
  ]

  const openPrs: OpenPullRequest[] = [
    {
      number: 100,
      title: 'fix-main: first fix attempt',
      createdAt: '2026-09-12T01:00:00Z',
    },
    {
      number: 101,
      title: 'fix-main: competing second attempt',
      createdAt: '2026-09-12T01:05:00Z',
    },
  ]

  // First PR acquires lock
  const first = evaluateMainHealth(runs, {
    prTitle: 'fix-main: first fix attempt',
    prNumber: 100,
    openPrs,
  })
  assert.equal(first.healthy, true)
  assert.equal(first.hotfixBypass, true)

  // Second PR is blocked by the mutex
  const second = evaluateMainHealth(runs, {
    prTitle: 'fix-main: competing second attempt',
    prNumber: 101,
    openPrs,
  })
  assert.equal(second.healthy, false)
  assert.equal(second.mutexBlocked, true)
  assert.match(second.message, /#100/)
  assert.match(second.message, /conflicting fixes/)
})
