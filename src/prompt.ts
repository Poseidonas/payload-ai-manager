import { readField } from './fingerprint.js'
import type { JsonSchema } from './providers/types.js'
import type { ResolvedCollection, ResolvedTarget, Settings } from './types.js'

const describe = (target: ResolvedTarget): string => {
  if (target.kind === 'description') {
    return `"${target.field}": a product description in plain prose. No headings, no markdown, no bullet points.`
  }

  if (target.kind === 'title') {
    return `"${target.field}": a product title. Plain text on one line, no quotes, no trailing full stop. Name the product, not its benefits.`
  }

  if (target.kind === 'attributes') {
    return `"${target.field}": an array of short attribute strings, each one "Name: value". Only attributes supported by the source material.`
  }

  return `"${target.field}": the source material translated into ${target.locale}. Translate only, do not add or remove information.`
}

export const buildSchema = (targets: ResolvedTarget[]): JsonSchema => {
  const properties: Record<string, unknown> = {}

  for (const target of targets) {
    properties[target.field] =
      target.kind === 'attributes'
        ? { items: { type: 'string' }, type: 'array' }
        : { type: 'string' }
  }

  return {
    additionalProperties: false,
    properties,
    required: targets.map((target) => target.field),
    type: 'object',
  }
}

export const buildSystem = (targets: ResolvedTarget[], settings: Settings): string => {
  const lines = [
    'You write catalogue copy for an online shop.',
    'Work only from the source material you are given. Never invent a specification, a measurement, a material, a certification or a claim that is not there.',
    'If the source material is too thin for a field, return an empty string for it rather than filling it with generic marketing language.',
    'Return JSON matching the requested shape, and nothing else.',
    '',
    'Fields:',
    ...targets.map((target) => `- ${describe(target)}`),
  ]

  const extra = targets
    .filter((target) => target.instructions !== '')
    .map((target) => `- ${target.field}: ${target.instructions}`)

  if (extra.length > 0) {
    lines.push('', 'Additional instructions:', ...extra)
  }

  if (settings.tone !== '') {
    lines.push('', 'House style:', settings.tone)
  }

  return lines.join('\n')
}

export const buildPrompt = (
  document: Record<string, unknown>,
  collection: ResolvedCollection,
): string => {
  const lines: string[] = ['Source material:', '']

  for (const field of collection.sourceFields) {
    const value = readField(document, field)

    if (value === undefined || value === '') {
      continue
    }

    lines.push(`${field}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }

  return lines.join('\n')
}

export const hasSource = (
  document: Record<string, unknown>,
  collection: ResolvedCollection,
): boolean =>
  collection.sourceFields.some((field) => {
    const value = readField(document, field)

    return value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
  })
