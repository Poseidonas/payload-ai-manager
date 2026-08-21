import { describe, expect, it } from 'vitest'

import { applyResult, coerce } from '../src/apply.js'
import type { ResolvedTarget } from '../src/types.js'

const target = (over: Partial<ResolvedTarget> = {}): ResolvedTarget => ({
  field: 'description',
  instructions: '',
  kind: 'description',
  locale: '',
  maxLength: 0,
  ...over,
})

describe('coerce', () => {
  it('trims a string', () => {
    expect(coerce('  Chair  ', target())).toBe('Chair')
  })

  it('rejects an empty string, so an empty answer never overwrites real copy', () => {
    expect(coerce('   ', target())).toBeNull()
  })

  it('rejects a non string for a text target', () => {
    expect(coerce(42, target())).toBeNull()
    expect(coerce(['a'], target())).toBeNull()
  })

  it('truncates at maxLength without cutting mid space', () => {
    expect(coerce('abcdefghij', target({ maxLength: 5 }))).toBe('abcde')
    expect(coerce('abcde fghij', target({ maxLength: 6 }))).toBe('abcde')
  })

  it('leaves a string shorter than maxLength alone', () => {
    expect(coerce('abc', target({ maxLength: 10 }))).toBe('abc')
  })

  it('keeps only non empty strings in an attribute list', () => {
    const result = coerce(['Colour: red', '  ', 'Size: 40', 7], target({ kind: 'attributes' }))

    expect(result).toEqual(['Colour: red', 'Size: 40'])
  })

  it('rejects an attribute list that is not an array', () => {
    expect(coerce('Colour: red', target({ kind: 'attributes' }))).toBeNull()
  })

  it('rejects an attribute list that ends up empty', () => {
    expect(coerce(['   ', ''], target({ kind: 'attributes' }))).toBeNull()
  })
})

describe('applyResult', () => {
  it('writes only the fields the model actually answered', () => {
    const { updates, written } = applyResult(
      { attributes: ['Colour: red'], description: 'A chair.' },
      [target(), target({ field: 'attributes', kind: 'attributes' })],
    )

    expect(written).toEqual(['description', 'attributes'])
    expect(updates).toEqual({ attributes: ['Colour: red'], description: 'A chair.' })
  })

  it('skips a field the model left empty rather than blanking it', () => {
    const { updates, written } = applyResult({ description: '' }, [target()])

    expect(written).toEqual([])
    expect(updates).toEqual({})
  })

  it('ignores a field the model invented that was not asked for', () => {
    const { updates } = applyResult({ description: 'A chair.', price: 10 }, [target()])

    expect(updates).toEqual({ description: 'A chair.' })
  })

  it('reports nothing written when the answer is unusable', () => {
    expect(applyResult({}, [target()]).written).toEqual([])
  })
})
