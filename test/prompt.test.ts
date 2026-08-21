import { describe, expect, it } from 'vitest'

import { buildPrompt, buildSchema, buildSystem, hasSource } from '../src/prompt.js'
import type { ResolvedCollection, ResolvedTarget, Settings } from '../src/types.js'

const target = (over: Partial<ResolvedTarget>): ResolvedTarget => ({
  field: 'description',
  instructions: '',
  kind: 'description',
  locale: '',
  maxLength: 0,
  ...over,
})

const settings: Settings = {
  apiKey: '',
  apiKeyEnv: '',
  baseUrl: '',
  enabled: true,
  model: '',
  targets: {},
  provider: 'anthropic',
  tone: '',
}

const collection: ResolvedCollection = {
  auto: false,
  sourceFields: ['title', 'brand'],
  targets: [target({})],
}

describe('buildSchema', () => {
  it('asks for a string for a description', () => {
    expect(buildSchema([target({})]).properties.description).toEqual({ type: 'string' })
  })

  it('asks for an array of strings for attributes', () => {
    const schema = buildSchema([target({ field: 'attributes', kind: 'attributes' })])

    expect(schema.properties.attributes).toEqual({ items: { type: 'string' }, type: 'array' })
  })

  it('requires every target, so a partial answer is rejected by the provider', () => {
    const schema = buildSchema([
      target({}),
      target({ field: 'attributes', kind: 'attributes' }),
    ])

    expect(schema.required).toEqual(['description', 'attributes'])
  })

  it('forbids extra properties', () => {
    expect(buildSchema([target({})]).additionalProperties).toBe(false)
  })
})

describe('buildSystem', () => {
  it('forbids invention, which is the whole point of the prompt', () => {
    const text = buildSystem([target({})], settings)

    expect(text).toContain('Never invent')
    expect(text).toContain('empty string')
  })

  it('names the target locale for a translation', () => {
    const text = buildSystem([target({ field: 'el', kind: 'translation', locale: 'Greek' })], settings)

    expect(text).toContain('Greek')
    expect(text).toContain('Translate only')
  })

  it('includes per target instructions when given', () => {
    const text = buildSystem([target({ instructions: 'Mention the warranty.' })], settings)

    expect(text).toContain('Mention the warranty.')
  })

  it('omits the instructions section entirely when there are none', () => {
    expect(buildSystem([target({})], settings)).not.toContain('Additional instructions')
  })

  it('includes the house style when set', () => {
    const text = buildSystem([target({})], { ...settings, tone: 'Never say revolutionary.' })

    expect(text).toContain('Never say revolutionary.')
  })

  it('omits the house style section when empty', () => {
    expect(buildSystem([target({})], settings)).not.toContain('House style')
  })
})

describe('buildPrompt', () => {
  it('includes only the configured source fields', () => {
    const text = buildPrompt({ brand: 'Acme', secret: 'hidden', title: 'Chair' }, collection)

    expect(text).toContain('title: Chair')
    expect(text).toContain('brand: Acme')
    expect(text).not.toContain('hidden')
  })

  it('skips a field that is missing or empty', () => {
    const text = buildPrompt({ brand: '', title: 'Chair' }, collection)

    expect(text).not.toContain('brand:')
  })

  it('serialises a non string value rather than printing [object Object]', () => {
    const text = buildPrompt({ title: { a: 1 } }, collection)

    expect(text).toContain('{"a":1}')
  })
})

describe('hasSource', () => {
  it('is false when every source field is missing', () => {
    expect(hasSource({ sku: 'X-1' }, collection)).toBe(false)
  })

  it('is false when the only value is an empty string', () => {
    expect(hasSource({ title: '' }, collection)).toBe(false)
  })

  it('is false when the only value is an empty array', () => {
    expect(hasSource({ title: [] }, collection)).toBe(false)
  })

  it('is true when one source field carries something', () => {
    expect(hasSource({ title: 'Chair' }, collection)).toBe(true)
  })
})
