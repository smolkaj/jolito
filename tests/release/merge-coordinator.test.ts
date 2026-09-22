import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortPRQueue, type QueuedPR } from '../../scripts/merge-coordinator.ts'

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
