import { describe, expect, it } from 'vitest'
import {
  handleAasaRequest,
  AASA_CONTENT,
  APP_ID,
  APPLE_TEAM_ID,
  APP_BUNDLE_ID,
} from './aasa-route'

describe('Apple App Site Association route', () => {
  it('identifies exact Team ID, Bundle ID, and App ID', () => {
    expect(APPLE_TEAM_ID).toBe('XQCN5RWS6V')
    expect(APP_BUNDLE_ID).toBe('to.joli.app')
    expect(APP_ID).toBe('XQCN5RWS6V.to.joli.app')
  })

  it('declares valid Universal Links (applinks) and Web Credentials schemas', () => {
    expect(AASA_CONTENT.applinks.details[0]?.appID).toBe(
      'XQCN5RWS6V.to.joli.app',
    )
    expect(AASA_CONTENT.applinks.details[0]?.appIDs).toContain(
      'XQCN5RWS6V.to.joli.app',
    )
    expect(AASA_CONTENT.applinks.details[0]?.paths).toContain('*')
    expect(AASA_CONTENT.webcredentials.apps).toContain('XQCN5RWS6V.to.joli.app')
  })

  it('serves HTTP 200 with application/json MIME type and permissive CORS', async () => {
    const response = handleAasaRequest()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toContain('max-age')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')

    const json: unknown = await response.json()
    expect(json).toEqual(AASA_CONTENT)
  })
})
