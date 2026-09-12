import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateMainHealth,
  type WorkflowRun,
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

void test('allows hotfix PRs to bypass failing mainline check to break deadlocks', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'iOS Native Build',
      conclusion: 'failure',
      status: 'completed',
      headSha: 'abc1234',
      url: 'https://github.com/smolkaj/jolito/actions/runs/2',
    },
  ]

  const byBranch = evaluateMainHealth(runs, {
    headRef: 'fix-main/restore-simulator',
  })
  assert.equal(byBranch.healthy, true)
  assert.equal(byBranch.hotfixBypass, true)

  const byTitle = evaluateMainHealth(runs, {
    prTitle: 'fix(ci): [fix-main] restore simulator',
  })
  assert.equal(byTitle.healthy, true)
  assert.equal(byTitle.hotfixBypass, true)
})
