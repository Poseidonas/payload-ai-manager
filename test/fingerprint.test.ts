import { describe, expect, it } from 'vitest'

import { fingerprint, readField } from '../src/fingerprint.js'
import type { ResolvedCollection } from '../src/types.js'

const collection: ResolvedCollection = {
  auto: false,
  sourceFields: ['title', 'brand'],
  targets: [
    { field: 'description', instructions: '', kind: 'description', locale: '', maxLength: 0 },
  ],
}

describe('readField', () => {
  it('reduces a populated relationship to its id, so depth does not change the result', () => {
    expect(readField({ brand: { id: 7, name: 'Acme' } }, 'brand')).toBe(7)
  })

  it('treats null and undefined alike', () => {
    expect(readField({ brand: null }, 'brand')).toBeUndefined()
    expect(readField({}, 'brand')).toBeUndefined()
  })

  it('passes a plain value through', () => {
    expect(readField({ title: 'Chair' }, 'title')).toBe('Chair')
  })
})

describe('fingerprint', () => {
  it('is stable across repeated calls', () => {
    const doc = { brand: 1, title: 'Chair' }

    expect(fingerprint(doc, collection)).toBe(fingerprint(doc, collection))
  })

  it('ignores key order in the document', () => {
    expect(fingerprint({ brand: 1, title: 'Chair' }, collection)).toBe(
      fingerprint({ title: 'Chair', brand: 1 }, collection),
    )
  })

  it('ignores key order inside a nested object', () => {
    const a = { title: { a: 1, b: 2 } }
    const b = { title: { b: 2, a: 1 } }

    expect(fingerprint(a, collection)).toBe(fingerprint(b, collection))
  })

  it('changes when a source field changes', () => {
    expect(fingerprint({ title: 'Chair' }, collection)).not.toBe(
      fingerprint({ title: 'Stool' }, collection),
    )
  })

  it('ignores a field that is not a source field', () => {
    expect(fingerprint({ title: 'Chair' }, collection)).toBe(
      fingerprint({ sku: 'X-1', title: 'Chair' }, collection),
    )
  })

  it('changes when a populated relationship points somewhere else', () => {
    expect(fingerprint({ brand: { id: 1 }, title: 'Chair' }, collection)).not.toBe(
      fingerprint({ brand: { id: 2 }, title: 'Chair' }, collection),
    )
  })

  it('does not change when the same relationship arrives populated or as an id', () => {
    expect(fingerprint({ brand: 1, title: 'Chair' }, collection)).toBe(
      fingerprint({ brand: { id: 1, name: 'Acme' }, title: 'Chair' }, collection),
    )
  })

  it('changes when a target is added, so new fields are generated', () => {
    const extra: ResolvedCollection = {
      ...collection,
      targets: [
        ...collection.targets,
        { field: 'attributes', instructions: '', kind: 'attributes', locale: '', maxLength: 0 },
      ],
    }

    expect(fingerprint({ title: 'Chair' }, collection)).not.toBe(
      fingerprint({ title: 'Chair' }, extra),
    )
  })

  it('changes when the instructions for a target change', () => {
    const tweaked: ResolvedCollection = {
      ...collection,
      targets: [{ ...collection.targets[0]!, instructions: 'Mention the warranty.' }],
    }

    expect(fingerprint({ title: 'Chair' }, collection)).not.toBe(
      fingerprint({ title: 'Chair' }, tweaked),
    )
  })

  it('treats a missing field and an absent one the same way', () => {
    expect(fingerprint({ brand: undefined, title: 'Chair' }, collection)).toBe(
      fingerprint({ title: 'Chair' }, collection),
    )
  })

  it('is 32 characters of hex', () => {
    expect(fingerprint({ title: 'Chair' }, collection)).toMatch(/^[0-9a-f]{32}$/)
  })
})
