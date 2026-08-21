import type { Field } from 'payload'

import type { ResolvedConfig } from './types.js'

export type StatusValue = {
  fields?: unknown
  fingerprint?: unknown
  generatedAt?: unknown
  model?: unknown
  provider?: unknown
}

export const statusGroup = (config: ResolvedConfig): Field => ({
  name: config.statusField,
  type: 'group',
  admin: {
    description:
      'Written by payload-ai-manager. A document is only regenerated when its source fields change, or when generation is forced.',
    position: 'sidebar',
  },
  fields: [
    { name: 'generatedAt', type: 'date', admin: { readOnly: true } },
    { name: 'provider', type: 'text', admin: { readOnly: true } },
    { name: 'model', type: 'text', admin: { readOnly: true } },
    { name: 'fingerprint', type: 'text', admin: { hidden: true }, index: true },
    { name: 'fields', type: 'text', admin: { readOnly: true }, hasMany: true },
  ],
  label: 'AI generation',
})

export const readStatus = (
  document: Record<string, unknown>,
  config: ResolvedConfig,
): StatusValue => {
  const value = document[config.statusField]

  return value !== null && typeof value === 'object' ? (value as StatusValue) : {}
}

export const isUpToDate = (
  document: Record<string, unknown>,
  config: ResolvedConfig,
  current: string,
): boolean => {
  const status = readStatus(document, config)

  return typeof status.fingerprint === 'string' && status.fingerprint === current
}
