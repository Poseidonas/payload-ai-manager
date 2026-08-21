import type { CollectionConfig, Config } from 'payload'

import { describe, expect, it } from 'vitest'

import { aiManagerPlugin } from '../src/index.js'
import { isUpToDate } from '../src/status.js'
import { resolveConfig } from '../src/config.js'

const products: CollectionConfig = {
  slug: 'products',
  fields: [{ name: 'title', type: 'text' }],
}

const base = (collections: CollectionConfig[]): Config => ({ collections }) as Config

const options = {
  collections: {
    products: {
      sourceFields: ['title'],
      targets: [{ field: 'description', kind: 'description' as const }],
    },
  },
}

const fieldNames = (config: Config, slug: string): string[] =>
  (config.collections?.find((c) => c.slug === slug)?.fields ?? []).map((f) =>
    'name' in f && typeof f.name === 'string' ? f.name : '',
  )

describe('aiManagerPlugin', () => {
  it('notes on a target field that the plugin writes to it', () => {
    const withTarget: CollectionConfig = {
      slug: 'products',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
      ],
    }

    const result = aiManagerPlugin(options)(base([withTarget]))
    const fields = result.collections?.find((c) => c.slug === 'products')?.fields ?? []
    const description = fields.find((f) => 'name' in f && f.name === 'description')
    const title = fields.find((f) => 'name' in f && f.name === 'title')

    expect((description as { admin?: { description?: string } }).admin?.description).toContain(
      'Written by AI Manager',
    )
    // a field that is only read, never written, is left alone
    expect((title as { admin?: { description?: string } }).admin?.description).toBeUndefined()
  })

  it('leaves an existing field description alone', () => {
    const withOwnDescription: CollectionConfig = {
      slug: 'products',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea', admin: { description: 'Shown on the product page.' } },
      ],
    }

    const result = aiManagerPlugin(options)(base([withOwnDescription]))
    const fields = result.collections?.find((c) => c.slug === 'products')?.fields ?? []
    const description = fields.find((f) => 'name' in f && f.name === 'description')

    expect((description as { admin?: { description?: string } }).admin?.description).toBe(
      'Shown on the product page.',
    )
  })

  it('adds one settings switch per target', () => {
    const result = aiManagerPlugin(options)(base([products]))
    const global = result.globals?.find((g) => g.slug === 'ai-manager')
    const group = global?.fields.find((f) => 'name' in f && f.name === 'targets')
    const switches = (group as { fields?: { name?: string }[] })?.fields ?? []

    expect(switches.map((f) => f.name)).toEqual(['products__description'])
  })

  it('adds the status group to a configured collection', () => {
    const result = aiManagerPlugin(options)(base([products]))

    expect(fieldNames(result, 'products')).toEqual(['title', 'aiStatus'])
  })

  it('adds the settings global, which is what puts it in the admin menu', () => {
    const result = aiManagerPlugin(options)(base([products]))

    expect(result.globals?.map((g) => g.slug)).toContain('ai-manager')
  })

  it('adds the manual endpoint', () => {
    const result = aiManagerPlugin(options)(base([products]))

    expect(result.endpoints?.some((e) => e.path === '/ai-manager/generate')).toBe(true)
  })

  it('leaves collections it was not told about untouched', () => {
    const pages: CollectionConfig = { slug: 'pages', fields: [{ name: 'title', type: 'text' }] }
    const result = aiManagerPlugin(options)(base([products, pages]))

    expect(fieldNames(result, 'pages')).toEqual(['title'])
  })

  it('returns the config unchanged when nothing usable was configured', () => {
    const input = base([products])
    const result = aiManagerPlugin({ collections: {} })(input)

    expect(result).toBe(input)
  })

  it('keeps hooks the collection already had', () => {
    const existing = (): null => null
    const withHook: CollectionConfig = {
      ...products,
      hooks: { afterChange: [existing as never] },
    }
    const result = aiManagerPlugin(options)(base([withHook]))
    const hooks = result.collections?.find((c) => c.slug === 'products')?.hooks?.afterChange

    expect(hooks).toHaveLength(2)
    expect(hooks?.[0]).toBe(existing)
  })

  it('honours a custom status field name', () => {
    const result = aiManagerPlugin({ ...options, statusField: 'generation' })(base([products]))

    expect(fieldNames(result, 'products')).toContain('generation')
  })

  it('honours a custom settings slug', () => {
    const result = aiManagerPlugin({ ...options, settingsSlug: 'copy-settings' })(base([products]))

    expect(result.globals?.map((g) => g.slug)).toContain('copy-settings')
  })

  it('still adds the fields when disabled, so the database keeps its shape', () => {
    const result = aiManagerPlugin({ ...options, disabled: true })(base([products]))

    expect(fieldNames(result, 'products')).toContain('aiStatus')
  })

  it('hides the stored key from API reads', () => {
    const result = aiManagerPlugin(options)(base([products]))
    const global = result.globals?.find((g) => g.slug === 'ai-manager')
    const key = global?.fields.find((f) => 'name' in f && f.name === 'apiKey')

    expect(key).toBeDefined()
    expect((key as { access?: { read?: () => boolean } }).access?.read?.()).toBe(false)
  })
})

describe('isUpToDate', () => {
  const config = resolveConfig(options)

  it('is false when the document was never generated', () => {
    expect(isUpToDate({}, config, 'abc')).toBe(false)
  })

  it('is true when the stored fingerprint matches', () => {
    expect(isUpToDate({ aiStatus: { fingerprint: 'abc' } }, config, 'abc')).toBe(true)
  })

  it('is false when the source changed, which is what triggers a rerun', () => {
    expect(isUpToDate({ aiStatus: { fingerprint: 'abc' } }, config, 'xyz')).toBe(false)
  })

  it('is false when the stored value is not a string', () => {
    expect(isUpToDate({ aiStatus: { fingerprint: 42 } }, config, 'abc')).toBe(false)
  })
})
