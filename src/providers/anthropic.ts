import { codeForStatus, ProviderError } from './errors.js'
import type { Provider, ProviderRequest, ProviderResult } from './types.js'

type AnthropicModule = {
  default: new (options: { apiKey: string; baseURL?: string }) => {
    messages: {
      create: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<{
        content: { text?: string; type: string }[]
        model: string
        stop_reason?: string
      }>
    }
  }
}

const loadSdk = async (): Promise<AnthropicModule> => {
  try {
    return (await import('@anthropic-ai/sdk')) as unknown as AnthropicModule
  } catch {
    throw new ProviderError(
      'anthropic',
      'MISSING_SDK',
      'The Claude provider needs @anthropic-ai/sdk. Install it, or choose another provider.',
    )
  }
}

const readStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown })?.status

  return typeof status === 'number' ? status : undefined
}

const generate = async (request: ProviderRequest): Promise<ProviderResult> => {
  const sdk = await loadSdk()
  const client = new sdk.default({
    apiKey: request.apiKey,
    ...(request.baseUrl ? { baseURL: request.baseUrl } : {}),
  })

  let response

  try {
    response = await client.messages.create(
      {
        max_tokens: request.maxOutputTokens,
        messages: [{ content: request.prompt, role: 'user' }],
        model: request.model,
        output_config: { format: { schema: request.schema, type: 'json_schema' } },
        system: request.system,
        thinking: { type: 'adaptive' },
      },
      request.signal ? { signal: request.signal } : undefined,
    )
  } catch (error) {
    const status = readStatus(error)
    const message = error instanceof Error ? error.message : 'Request to Claude failed.'

    throw new ProviderError(
      'anthropic',
      status === undefined ? 'TRANSPORT' : codeForStatus(status, message),
      message,
      status,
    )
  }

  if (response.stop_reason === 'refusal') {
    throw new ProviderError('anthropic', 'REFUSED', 'Claude declined to answer this request.')
  }

  const text = response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')

  return { data: parseJson('anthropic', text), model: response.model }
}

export const parseJson = (provider: string, text: string): Record<string, unknown> => {
  const trimmed = text.trim()

  if (trimmed === '') {
    throw new ProviderError(provider, 'INVALID_RESPONSE', 'The model returned nothing.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new ProviderError(provider, 'INVALID_RESPONSE', 'The model did not return JSON.')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProviderError(provider, 'INVALID_RESPONSE', 'The model returned JSON that is not an object.')
  }

  return parsed as Record<string, unknown>
}

export const anthropicProvider: Provider = {
  consoleUrl: 'https://console.anthropic.com/settings/keys',
  defaultBaseUrl: '',
  defaultModel: 'claude-opus-5',
  generate,
  id: 'anthropic',
  label: 'Claude',
}
