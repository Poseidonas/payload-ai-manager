import type { CollectionAfterChangeHook } from 'payload'

import { generateFor } from './generate.js'
import type { ResolvedConfig } from './types.js'

const GUARD = 'aiManagerRunning'

export const autoGenerate =
  (config: ResolvedConfig, slug: string): CollectionAfterChangeHook =>
  async ({ doc, req }) => {
    const collection = config.collections[slug]

    if (config.disabled || collection === undefined || !collection.auto) {
      return doc
    }

    if (req.context?.[GUARD] === true) {
      return doc
    }

    const document = doc as Record<string, unknown>
    const outcome = await generateFor({ config, document, force: false, req, slug })

    if (outcome.status === 'skipped') {
      return doc
    }

    if (outcome.status === 'failed') {
      req.payload.logger.error(
        `payload-ai-manager: ${slug} ${String(document.id)} was not generated - ${outcome.reason}`,
      )

      return doc
    }

    try {
      return await req.payload.update({
        id: document.id as number | string,
        collection: slug,
        context: { [GUARD]: true },
        data: outcome.updates,
        depth: 0,
        overrideAccess: true,
        req,
      })
    } catch (error) {
      req.payload.logger.error(
        `payload-ai-manager: could not save generated fields for ${slug} ${String(document.id)} - ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )

      return doc
    }
  }
