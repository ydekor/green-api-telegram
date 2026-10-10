import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'

const routes = {
  getStateInstance: 'GET',
  getChats: 'GET',
  getAccountSettings: 'GET',
  lastIncomingMessages: 'GET',
  lastOutgoingMessages: 'GET',
  getContactInfo: 'POST',
  getAvatar: 'POST',
  getChatHistory: 'POST',
  checkAccount: 'POST',
  sendMessage: 'POST',
  sendFileByUpload: 'POST',
  receiveNotification: 'GET',
  deleteNotification: 'DELETE',
}
const allowedHost = (host) =>
  host === 'api.green-api.com' || /^[a-z0-9-]+\.api\.green-api\.com$/.test(host)
const allowedMediaHost = (host) =>
  host === 'media.green-api.com' ||
  /^[a-z0-9-]+\.media\.green-api\.com$/.test(host)

const jsonResponse = (body, status) =>
  new Response(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

export async function handleGreenRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname.startsWith('/api/green/')
    ? url.pathname.slice('/api/green/'.length)
    : url.pathname === '/api/green'
      ? url.searchParams.get('path')
      : null
  if (path === null) return null

  const parts = path.split('/')
  const [method, receiptId] = parts
  if (
    !method ||
    parts.length > 2 ||
    routes[method] !== request.method ||
    (method === 'deleteNotification' && !/^\d+$/.test(receiptId ?? '')) ||
    (method !== 'deleteNotification' && receiptId)
  )
    return jsonResponse('Not found', 404)

  const apiUrl = request.headers.get('x-green-url')
  const id = request.headers.get('x-green-id')
  const token = request.headers.get('x-green-token')
  const upload = method === 'sendFileByUpload'
  let origin
  try {
    origin = new URL(apiUrl)
    if (
      origin.protocol !== 'https:' ||
      !allowedHost(origin.hostname) ||
      origin.port ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    )
      throw Error('host')
    if (
      !/^\d{6,15}$/.test(id ?? '') ||
      !/^[A-Za-z0-9_-]{8,256}$/.test(token ?? '')
    )
      throw Error('credentials')
  } catch {
    return jsonResponse('Invalid connection parameters', 400)
  }

  let mediaOrigin
  if (upload) {
    try {
      mediaOrigin = new URL(
        request.headers.get('x-green-media-url') ||
          'https://media.green-api.com/',
      )
      if (
        mediaOrigin.protocol !== 'https:' ||
        !allowedMediaHost(mediaOrigin.hostname) ||
        mediaOrigin.port ||
        mediaOrigin.username ||
        mediaOrigin.password ||
        mediaOrigin.pathname !== '/' ||
        mediaOrigin.search ||
        mediaOrigin.hash
      )
        throw Error('media host')
      if (
        !String(request.headers.get('content-type') || '').startsWith(
          'multipart/form-data;',
        )
      )
        throw Error('content type')
      if (Number(request.headers.get('content-length') || 0) > 21 * 1024 * 1024)
        throw Error('size')
    } catch {
      return jsonResponse('Invalid upload parameters', 400)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    method === 'receiveNotification' ? 12000 : upload ? 55000 : 20000,
  )
  const signal = AbortSignal.any([request.signal, controller.signal])
  try {
    let body
    if (request.method === 'POST') {
      if (upload) {
        body = await request.arrayBuffer()
        if (body.byteLength > 21 * 1024 * 1024)
          return jsonResponse('File too large', 413)
      } else {
        const text = await request.text()
        if (text.length > 65536) return jsonResponse('Request too large', 413)
        body = JSON.stringify(JSON.parse(text || '{}'))
      }
    }

    const target = new URL(
      `/waInstance${id}/${method}/${token}${receiptId ? `/${receiptId}` : ''}`,
      upload ? mediaOrigin : origin,
    )
    if (method === 'receiveNotification')
      target.searchParams.set('receiveTimeout', '5')

    const response = await fetch(target, {
      method: request.method,
      body,
      headers: body
        ? {
            'Content-Type': upload
              ? request.headers.get('content-type')
              : 'application/json',
          }
        : undefined,
      signal,
      redirect: 'error',
    })
    return jsonResponse(await response.text(), response.status)
  } catch {
    return jsonResponse(
      JSON.stringify({ error: 'Upstream unavailable' }),
      controller.signal.aborted ? 504 : 502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function proxyHandler(req, res, next) {
  if (!new URL(req.url, 'http://localhost').pathname.startsWith('/api/green/'))
    return next()

  const controller = new AbortController()
  req.on('aborted', () => controller.abort())
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  try {
    const request = new Request(new URL(req.url, 'http://localhost'), {
      method: req.method,
      headers: req.headers,
      body: req.method === 'POST' ? Readable.toWeb(req) : undefined,
      duplex: 'half',
      signal: controller.signal,
    })
    const response = await handleGreenRequest(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    if (!res.writableEnded)
      res
        .writeHead(502, { 'Cache-Control': 'no-store' })
        .end('Upstream unavailable')
  }
}
