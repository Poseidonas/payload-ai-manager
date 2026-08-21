import { createHash } from 'node:crypto'

import type { ResolvedCollection } from './types.js'

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stable)
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const key of Object.keys(source).sort()) {
      out[key] = stable(source[key])
    }

    return out
  }

  return value
}

export const readField = (document: Record<string, unknown>, field: string): unknown => {
  const value = document[field]

  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).id
  }

  return value
}

export const fingerprint = (
  document: Record<string, unknown>,
  collection: ResolvedCollection,
): string => {
  const source: Record<string, unknown> = {}

  for (const field of collection.sourceFields) {
    const value = readField(document, field)

    if (value !== undefined) {
      source[field] = stable(value)
    }
  }

  const targets = collection.targets.map((target) => [
    target.field,
    target.kind,
    target.locale,
    target.instructions,
  ])

  return createHash('sha256')
    .update(JSON.stringify({ source, targets }))
    .digest('hex')
    .slice(0, 32)
}
