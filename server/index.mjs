import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { proxyHandler } from './proxy.mjs'

const app = express()
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(proxyHandler)
app.use(express.static(dist))
app.use((_req, res) => res.sendFile(join(dist, 'index.html')))
app.listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1')
