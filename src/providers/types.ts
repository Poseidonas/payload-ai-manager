export type ProviderId = 'anthropic' | 'google' | 'kimi' | 'openai'

export type JsonSchema = {
  additionalProperties: false
  properties: Record<string, unknown>
  required: string[]
  type: 'object'
}

export type ProviderRequest = {
  apiKey: string
  baseUrl?: string
  maxOutputTokens: number
  model: string
  prompt: string
  schema: JsonSchema
  signal?: AbortSignal
  system: string
}

export type ProviderResult = {
  data: Record<string, unknown>
  model: string
}

export type Provider = {
  /** Where to get a key, shown in the settings description. */
  consoleUrl: string
  defaultBaseUrl: string
  defaultModel: string
  generate: (request: ProviderRequest) => Promise<ProviderResult>
  id: ProviderId
  label: string
}
