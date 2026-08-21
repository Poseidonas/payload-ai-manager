import { describe, expect, it } from 'vitest'

import { parseJson } from '../src/providers/anthropic.js'
import { codeForStatus, messageFromBody, ProviderError } from '../src/providers/errors.js'
import { providerFor, providerIds, providers } from '../src/providers/index.js'

describe('provider registry', () => {
  it('carries the four providers', () => {
    expect(providerIds.sort()).toEqual(['anthropic', 'google', 'kimi', 'openai'])
  })

  it('gives every provider a label, a default model and a console url', () => {
    for (const id of providerIds) {
      const provider = providers[id]

      expect(provider.label).not.toBe('')
      expect(provider.defaultModel).not.toBe('')
      expect(provider.consoleUrl).toMatch(/^https:\/\//)
    }
  })

  it('points Kimi at Moonshot rather than a generic endpoint', () => {
    expect(providers.kimi.defaultBaseUrl).toBe('https://api.moonshot.ai/v1')
  })

  it('leaves the Claude base url empty so the SDK default is used', () => {
    expect(providers.anthropic.defaultBaseUrl).toBe('')
  })

  it('returns undefined for an unknown id', () => {
    expect(providerFor('deepseek')).toBeUndefined()
  })

  it('does not treat an inherited property name as a provider', () => {
    expect(providerFor('constructor')).toBeUndefined()
    expect(providerFor('toString')).toBeUndefined()
  })

  it('resolves a known id', () => {
    expect(providerFor('kimi')?.label).toBe('Kimi')
  })
})

describe('parseJson', () => {
  it('parses an object', () => {
    expect(parseJson('test', '{"a":1}')).toEqual({ a: 1 })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseJson('test', '  {"a":1}\n')).toEqual({ a: 1 })
  })

  it('refuses an empty answer', () => {
    expect(() => parseJson('test', '   ')).toThrow(ProviderError)
  })

  it('refuses text that is not JSON', () => {
    expect(() => parseJson('test', 'Here is your description!')).toThrow(/did not return JSON/)
  })

  it('refuses a JSON array, since the schema asks for an object', () => {
    expect(() => parseJson('test', '[1,2]')).toThrow(/not an object/)
  })

  it('refuses JSON null', () => {
    expect(() => parseJson('test', 'null')).toThrow(/not an object/)
  })

  it('marks the failure as INVALID_RESPONSE', () => {
    try {
      parseJson('test', 'nope')
      expect.unreachable()
    } catch (error) {
      expect((error as ProviderError).code).toBe('INVALID_RESPONSE')
      expect((error as ProviderError).provider).toBe('test')
    }
  })
})

describe('codeForStatus', () => {
  it('separates auth from rate limiting from everything else', () => {
    expect(codeForStatus(401)).toBe('AUTH')
    expect(codeForStatus(403)).toBe('AUTH')
    expect(codeForStatus(429)).toBe('RATE_LIMIT')
    expect(codeForStatus(500)).toBe('TRANSPORT')
    expect(codeForStatus(400)).toBe('TRANSPORT')
  })
})

describe('ProviderError', () => {
  it('keeps the status when one is given', () => {
    expect(new ProviderError('kimi', 'AUTH', 'bad key', 401).status).toBe(401)
  })

  it('leaves the status unset when there is none', () => {
    expect(new ProviderError('kimi', 'MISSING_SDK', 'no sdk').status).toBeUndefined()
  })

  it('is an Error, so ordinary handling still works', () => {
    expect(new ProviderError('kimi', 'AUTH', 'bad key')).toBeInstanceOf(Error)
  })
})

describe('messageFromBody', () => {
  it('reads the OpenAI shape', () => {
    expect(messageFromBody({ error: { message: 'Incorrect API key provided.' } })).toBe(
      'Incorrect API key provided.',
    )
  })

  it('reads the Google shape', () => {
    expect(
      messageFromBody({ error: { code: 400, message: 'API key not valid.', status: 'INVALID_ARGUMENT' } }),
    ).toBe('API key not valid.')
  })

  it('reads a bare message', () => {
    expect(messageFromBody({ message: 'nope' })).toBe('nope')
  })

  it('reads a string error', () => {
    expect(messageFromBody({ error: 'nope' })).toBe('nope')
  })

  it('returns empty for a body it cannot read', () => {
    expect(messageFromBody(null)).toBe('')
    expect(messageFromBody({ unrelated: 1 })).toBe('')
  })

  it('caps the length so a long body cannot flood a log', () => {
    expect(messageFromBody({ message: 'x'.repeat(500) })).toHaveLength(300)
  })
})

describe('codeForStatus with a message', () => {
  it('calls a Gemini style 400 an auth failure, because Gemini uses 400 for a bad key', () => {
    expect(codeForStatus(400, 'API key not valid. Please pass a valid API key.')).toBe('AUTH')
  })

  it('recognises other auth wording on a 400', () => {
    expect(codeForStatus(400, 'Unauthorized')).toBe('AUTH')
    expect(codeForStatus(400, 'permission denied')).toBe('AUTH')
  })

  it('leaves an ordinary 400 as transport', () => {
    expect(codeForStatus(400, 'schema is invalid')).toBe('TRANSPORT')
    expect(codeForStatus(400)).toBe('TRANSPORT')
  })

  it('still trusts an explicit 401 or 403 whatever the message says', () => {
    expect(codeForStatus(401, 'schema is invalid')).toBe('AUTH')
    expect(codeForStatus(403, '')).toBe('AUTH')
  })
})
