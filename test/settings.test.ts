import { describe, expect, it } from 'vitest'

import { readSettings, resolveApiKey } from '../src/settings.js'

describe('readSettings', () => {
  it('falls back to Claude when the stored provider is unknown', () => {
    expect(readSettings({ provider: 'nonsense' }).provider).toBe('anthropic')
  })

  it('keeps a known provider', () => {
    expect(readSettings({ provider: 'kimi' }).provider).toBe('kimi')
  })

  it('defaults to disabled, so installing the plugin costs nothing', () => {
    expect(readSettings({}).enabled).toBe(false)
    expect(readSettings(null).enabled).toBe(false)
  })

  it('reads every field it knows', () => {
    expect(
      readSettings({
        apiKey: 'k',
        apiKeyEnv: 'E',
        baseUrl: 'https://example.test/v1',
        enabled: true,
        model: 'm',
        provider: 'openai',
        tone: 't',
      }),
    ).toEqual({
      targets: {},
      apiKey: 'k',
      apiKeyEnv: 'E',
      baseUrl: 'https://example.test/v1',
      enabled: true,
      model: 'm',
      provider: 'openai',
      tone: 't',
    })
  })

  it('treats a target switch as enabled unless it is explicitly false', () => {
    const settings = readSettings({
      targets: { products__description: true, products__title: false },
    })

    expect(settings.targets.products__description).toBe(true)
    expect(settings.targets.products__title).toBe(false)
    // a target that was never switched is absent, and absent means enabled
    expect(settings.targets.products__attributes).toBeUndefined()
  })

  it('ignores a targets value that is not an object', () => {
    expect(readSettings({ targets: 'everything' }).targets).toEqual({})
  })

  it('ignores a non string where a string is expected', () => {
    expect(readSettings({ model: 42 }).model).toBe('')
  })
})

describe('resolveApiKey', () => {
  const base = readSettings({})

  it('prefers the environment variable over the stored key', () => {
    const key = resolveApiKey(
      { ...base, apiKey: 'stored', apiKeyEnv: 'MY_KEY' },
      { MY_KEY: 'from-env' },
    )

    expect(key).toBe('from-env')
  })

  it('falls back to the stored key when the variable is unset', () => {
    expect(resolveApiKey({ ...base, apiKey: 'stored', apiKeyEnv: 'MISSING' }, {})).toBe('stored')
  })

  it('falls back when the variable exists but is empty', () => {
    expect(
      resolveApiKey({ ...base, apiKey: 'stored', apiKeyEnv: 'EMPTY' }, { EMPTY: '' }),
    ).toBe('stored')
  })

  it('returns an empty string when neither is set, which stops generation', () => {
    expect(resolveApiKey(base, {})).toBe('')
  })
})
