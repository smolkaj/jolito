import { expect, it } from 'vitest'
import { readJsonBody } from './request-body'

it('rejects oversized streamed bodies without trusting content-length', async () => {
  const request = new Request('https://joli.to/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ message: 'x'.repeat(200) }),
    headers: { 'Content-Length': '1' },
  })
  await expect(readJsonBody(request, 100)).rejects.toMatchObject({
    status: 413,
  })
})

it('parses JSON across byte chunks and rejects malformed input', async () => {
  const request = new Request('https://joli.to', {
    method: 'POST',
    body: '{"text":"qué padre"}',
  })
  await expect(readJsonBody(request, 100)).resolves.toEqual({
    text: 'qué padre',
  })
  await expect(
    readJsonBody(
      new Request('https://joli.to', { method: 'POST', body: '{' }),
      100,
    ),
  ).rejects.toMatchObject({ status: 400 })
})
