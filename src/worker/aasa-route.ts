export const APPLE_TEAM_ID = 'XQCN5RWS6V'
export const APP_BUNDLE_ID = 'to.joli.app'
export const APP_ID = `${APPLE_TEAM_ID}.${APP_BUNDLE_ID}`

export const AASA_CONTENT = {
  applinks: {
    apps: [],
    details: [
      {
        appID: APP_ID,
        appIDs: [APP_ID],
        components: [
          {
            '/': '/*',
            comment: 'Matches all routes across Jolito',
          },
        ],
        paths: ['*'],
      },
    ],
  },
  webcredentials: {
    apps: [APP_ID],
  },
}

export function handleAasaRequest(): Response {
  return new Response(JSON.stringify(AASA_CONTENT, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
