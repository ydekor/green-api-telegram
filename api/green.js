import { handleGreenRequest } from '../server/proxy.mjs'

export default {
  async fetch(request) {
    return (
      (await handleGreenRequest(request)) ??
      new Response('Not found', { status: 404 })
    )
  },
}
