import type { ResolvedTarget } from './types.js'

export const coerce = (value: unknown, target: ResolvedTarget): null | string | string[] => {
  if (target.kind === 'attributes') {
    if (!Array.isArray(value)) {
      return null
    }

    const items = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')

    return items.length > 0 ? items : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()

  if (text === '') {
    return null
  }

  return target.maxLength > 0 && text.length > target.maxLength
    ? text.slice(0, target.maxLength).trimEnd()
    : text
}

export const applyResult = (
  data: Record<string, unknown>,
  targets: ResolvedTarget[],
): { updates: Record<string, unknown>; written: string[] } => {
  const updates: Record<string, unknown> = {}
  const written: string[] = []

  for (const target of targets) {
    const value = coerce(data[target.field], target)

    if (value !== null) {
      updates[target.field] = value
      written.push(target.field)
    }
  }

  return { updates, written }
}
