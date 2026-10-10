import type { IncomingMessage, ServerResponse } from 'node:http'
export function proxyHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): Promise<void>
