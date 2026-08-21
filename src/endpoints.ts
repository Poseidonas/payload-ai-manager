import { addDataAndFileToRequest } from 'payload'
import type { Endpoint, PayloadRequest } from 'payload'

import { generateFor } from './generate.js'
import type { ResolvedConfig } from './types.js'

const GUARD = 'aiManagerRunning'

const body = (req: PayloadRequest): Record<string, unknown> =>
  req.data !== null && typeof req.data === 'object'
    ? (req.data as Record<string, unknown>)
    : {}

export const generateEndpoint = (config: ResolvedConfig): Endpoint => ({
  handler: async (req) => {
    await addDataAndFileToRequest(req)

    if (req.user === null || req.user === undefined) {
      return Response.json({ message: 'Not allowed.' }, { status: 403 })
    }

    const data = body(req)
    const slug = typeof data.collection === 'string' ? data.collection : ''
    const id = data.id
    const force = data.force === true

    if (slug === '' || config.collections[slug] === undefined) {
      return Response.json(
        { message: 'Unknown collection.', collections: Object.keys(config.collections) },
        { status: 400 },
      )
    }

    if (typeof id !== 'number' && typeof id !== 'string') {
      return Response.json({ message: 'An id is required.' }, { status: 400 })
    }

    const document = (await req.payload.findByID({
      id,
      collection: slug,
      depth: 0,
      overrideAccess: false,
      req,
    })) as null | Record<string, unknown>

    if (document === null) {
      return Response.json({ message: 'Document not found.' }, { status: 404 })
    }

    const outcome = await generateFor({ config, document, force, req, slug })

    if (outcome.status === 'skipped') {
      return Response.json({ reason: outcome.reason, status: 'skipped' })
    }

    if (outcome.status === 'failed') {
      return Response.json({ reason: outcome.reason, status: 'failed' }, { status: 502 })
    }

    await req.payload.update({
      id,
      collection: slug,
      context: { [GUARD]: true },
      data: outcome.updates,
      depth: 0,
      overrideAccess: true,
      req,
    })

    return Response.json({ fields: outcome.written, status: 'generated' })
  },
  method: 'post',
  path: '/ai-manager/generate',
})
