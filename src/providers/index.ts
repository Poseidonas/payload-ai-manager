import { anthropicProvider } from './anthropic.js'
import { googleProvider } from './google.js'
import { kimiProvider } from './kimi.js'
import { openaiProvider } from './openai.js'
import type { Provider, ProviderId } from './types.js'

export const providers: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  google: googleProvider,
  kimi: kimiProvider,
  openai: openaiProvider,
}

export const providerIds = Object.keys(providers) as ProviderId[]

export const providerFor = (id: string): Provider | undefined =>
  Object.prototype.hasOwnProperty.call(providers, id)
    ? providers[id as ProviderId]
    : undefined
