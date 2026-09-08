import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        val = val.replace(/^["'](.*)["']$/, '$1')
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

export async function promptIfMissing(
  varName: string,
  promptText: string,
): Promise<string> {
  const existing = process.env[varName]
  if (existing) return existing.trim()

  const rl = readline.createInterface({ input, output })
  try {
    const answer = await rl.question(promptText)
    return answer.trim()
  } finally {
    rl.close()
  }
}

export interface CloudflareZone {
  id: string
  name: string
  name_servers: string[]
  status: string
}

export interface CloudflareAccount {
  id: string
  name: string
}

export async function cfApi<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const reqInit: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined) {
    reqInit.body = JSON.stringify(body)
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4${path}`,
    reqInit,
  )

  const rawText = await res.text()
  let data: {
    success: boolean
    result: T
    errors?: { code?: number; message: string }[]
  }
  try {
    data = JSON.parse(rawText) as {
      success: boolean
      result: T
      errors?: { code?: number; message: string }[]
    }
  } catch {
    throw new Error(
      `Cloudflare API error (${path}): HTTP ${res.status} ${res.statusText} - non-JSON response: ${rawText.slice(0, 200)}`,
    )
  }

  if (!data.success) {
    const errMsg =
      data.errors?.map((e) => e.message).join(', ') ?? res.statusText
    throw new Error(`Cloudflare API error (${path}): ${errMsg}`)
  }
  return data.result
}
