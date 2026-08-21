import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'

const base = {
  collections: {
    products: {
      sourceFields: ['title'],
      targets: [{ field: 'description', kind: 'description' as const }],
    },
  },
}

describe('resolveConfig', () => {
  it('fills in the documented defaults', () => {
    const result = resolveConfig(base)

    expect(result.disabled).toBe(false)
    expect(result.maxOutputTokens).toBe(2048)
    expect(result.settingsSlug).toBe('ai-manager')
    expect(result.statusField).toBe('aiStatus')
    expect(result.collections.products?.auto).toBe(false)
  })

  it('drops a collection with no source fields', () => {
    const result = resolveConfig({
      collections: {
        products: { sourceFields: [], targets: [{ field: 'description', kind: 'description' }] },
      },
    })

    expect(result.collections.products).toBeUndefined()
  })

  it('drops a collection with no usable target', () => {
    const result = resolveConfig({
      collections: { products: { sourceFields: ['title'], targets: [] } },
    })

    expect(result.collections.products).toBeUndefined()
  })

  it('drops a translation target with no locale, since it cannot be run', () => {
    const result = resolveConfig({
      collections: {
        products: { sourceFields: ['title'], targets: [{ field: 'el', kind: 'translation' }] },
      },
    })

    expect(result.collections.products).toBeUndefined()
  })

  it('keeps a translation target that has a locale', () => {
    const result = resolveConfig({
      collections: {
        products: {
          sourceFields: ['title'],
          targets: [{ field: 'el', kind: 'translation', locale: 'Greek' }],
        },
      },
    })

    expect(result.collections.products?.targets[0]?.locale).toBe('Greek')
  })

  it('rejects an unknown kind rather than guessing one', () => {
    const result = resolveConfig({
      collections: {
        products: {
          sourceFields: ['title'],
          targets: [{ field: 'description', kind: 'poem' as never }],
        },
      },
    })

    expect(result.collections.products).toBeUndefined()
  })

  it('refuses to write the same field twice', () => {
    const result = resolveConfig({
      collections: {
        products: {
          sourceFields: ['title'],
          targets: [
            { field: 'description', kind: 'description' },
            { field: 'description', kind: 'attributes' },
          ],
        },
      },
    })

    expect(result.collections.products?.targets).toHaveLength(1)
    expect(result.collections.products?.targets[0]?.kind).toBe('description')
  })

  it('removes duplicate source fields but keeps order', () => {
    const result = resolveConfig({
      collections: {
        products: {
          sourceFields: ['title', 'brand', 'title'],
          targets: [{ field: 'description', kind: 'description' }],
        },
      },
    })

    expect(result.collections.products?.sourceFields).toEqual(['title', 'brand'])
  })

  it('replaces an unusable maxOutputTokens instead of applying it', () => {
    expect(resolveConfig({ ...base, maxOutputTokens: 0 }).maxOutputTokens).toBe(2048)
    expect(resolveConfig({ ...base, maxOutputTokens: -100 }).maxOutputTokens).toBe(2048)
    expect(resolveConfig({ ...base, maxOutputTokens: 4096.9 }).maxOutputTokens).toBe(4096)
  })

  it('falls back when a slug is given as an empty string', () => {
    expect(resolveConfig({ ...base, settingsSlug: '   ' }).settingsSlug).toBe('ai-manager')
  })

  it('treats a negative maxLength as no limit rather than flipping its sign', () => {
    const result = resolveConfig({
      collections: {
        products: {
          sourceFields: ['title'],
          targets: [{ field: 'description', kind: 'description', maxLength: -20 }],
        },
      },
    })

    expect(result.collections.products?.targets[0]?.maxLength).toBe(0)
  })

  it('honours auto when it is set', () => {
    const result = resolveConfig({
      collections: { products: { ...base.collections.products, auto: true } },
    })

    expect(result.collections.products?.auto).toBe(true)
  })
})
