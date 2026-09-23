import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sortPRQueue,
  evaluateMainlineSettlement,
  evaluatePRMergeability,
  type QueuedPR,
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

void test('evaluateMainlineSettlement detects when mainline CI runs are still in progress', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: null,
      status: 'in_progress',
      url: 'https://example.com/1',
      headSha: 'abc1234',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/2',
      headSha: 'abc1234',
    },
  ]

  const result = evaluateMainlineSettlement(runs)
  assert.equal(result.settled, false)
  assert.equal(result.inProgress.length, 1)
  assert.equal(result.inProgress[0]?.workflowName, 'Quality')
})

void test('evaluateMainlineSettlement confirms settlement when all core runs are completed', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/1',
      headSha: 'abc1234',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/2',
      headSha: 'abc1234',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/3',
      headSha: 'abc1234',
    },
  ]

  const result = evaluateMainlineSettlement(runs)
  assert.equal(result.settled, true)
  assert.equal(result.inProgress.length, 0)
})

void test('evaluateMainlineSettlement ignores in-progress runs from older commits', () => {
  const runs: WorkflowRun[] = [
    {
      workflowName: 'Quality',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/latest-quality',
      headSha: 'new7890',
    },
    {
      workflowName: 'iOS Native Build',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/latest-ios',
      headSha: 'new7890',
    },
    {
      workflowName: 'CodeQL',
      conclusion: 'success',
      status: 'completed',
      url: 'https://example.com/latest-codeql',
      headSha: 'new7890',
    },
    {
      workflowName: 'Quality',
      conclusion: null,
      status: 'in_progress',
      url: 'https://example.com/old-quality',
      headSha: 'old1234',
    },
  ]

  const result = evaluateMainlineSettlement(runs)
  assert.equal(result.settled, true)
  assert.equal(result.latestSha, 'new7890')
})
