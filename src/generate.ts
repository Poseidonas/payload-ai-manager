import type { PayloadRequest } from 'payload'

import { applyResult } from './apply.js'
import { fingerprint } from './fingerprint.js'
import { buildPrompt, buildSchema, buildSystem, hasSource } from './prompt.js'
import { providerFor } from './providers/index.js'
import { ProviderError } from './providers/errors.js'
import { readSettings, resolveApiKey, targetKey } from './settings.js'
import { isUpToDate } from './status.js'
import type { ResolvedConfig } from './types.js'

export type GenerateOutcome =
  | { reason: 'disabled' | 'no-source' | 'not-configured' | 'unchanged'; status: 'skipped' }
  | { reason: string; status: 'failed' }
  | { status: 'generated'; updates: Record<string, unknown>; written: string[] }

export const generateFor = async ({
  config,
  document,
  force,
  req,
  slug,
}: {
  config: ResolvedConfig
  document: Record<string, unknown>
  force: boolean
  req: PayloadRequest
  slug: string
}): Promise<GenerateOutcome> => {
  const collection = config.collections[slug]

  if (config.disabled || collection === undefined) {
    return { reason: 'disabled', status: 'skipped' }
  }

  const settings = readSettings(
    await req.payload.findGlobal({ slug: config.settingsSlug, depth: 0, req }),
  )

  if (!settings.enabled) {
    return { reason: 'disabled', status: 'skipped' }
  }

  const provider = providerFor(settings.provider)
  const apiKey = resolveApiKey(settings, process.env)

  if (provider === undefined || apiKey === '') {
    return { reason: 'not-configured', status: 'skipped' }
  }

  // An editor can switch a field off in settings without a deploy. A target that is
  // off is not sent to the model and its current content is left exactly as it is.
  const targets = collection.targets.filter(
    (target) => settings.targets[targetKey(slug, target.field)] !== false,
  )

  if (targets.length === 0) {
    return { reason: 'disabled', status: 'skipped' }
  }

  if (!hasSource(document, collection)) {
    return { reason: 'no-source', status: 'skipped' }
  }

  const current = fingerprint(document, collection)

  if (!force && isUpToDate(document, config, current)) {
    return { reason: 'unchanged', status: 'skipped' }
  }

  try {
    const result = await provider.generate({
      apiKey,
      baseUrl: settings.baseUrl || provider.defaultBaseUrl,
      maxOutputTokens: config.maxOutputTokens,
      model: settings.model || provider.defaultModel,
      prompt: buildPrompt(document, collection),
      schema: buildSchema(targets),
      system: buildSystem(targets, settings),
    })

    const { updates, written } = applyResult(result.data, targets)

    if (written.length === 0) {
      return { reason: 'the model returned nothing usable', status: 'failed' }
    }

    return {
      status: 'generated',
      updates: {
        ...updates,
        [config.statusField]: {
          fields: written,
          fingerprint: current,
          generatedAt: new Date().toISOString(),
          model: result.model,
          provider: provider.id,
        },
      },
      written,
    }
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'unknown error'

    return { reason: message, status: 'failed' }
  }
}
