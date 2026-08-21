import { parseJson } from './anthropic.js'
import { codeForStatus, messageFromBody, ProviderError } from './errors.js'
import type { ProviderRequest, ProviderResult } from './types.js'

type ChatResponse = {
  choices?: { message?: { content?: unknown } }[]
  model?: unknown
}

export const chatCompletion = async (
  provider: string,
  baseUrl: string,
  request: ProviderRequest,
): Promise<ProviderResult> => {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  let response: Response

  try {
    response = await fetch(url, {
      body: JSON.stringify({
        max_tokens: request.maxOutputTokens,
        messages: [
          { content: request.system, role: 'system' },
          { content: request.prompt, role: 'user' },
        ],
        model: request.model,
        response_format: {
          json_schema: { name: 'result', schema: request.schema, strict: true },
          type: 'json_schema',
        },
      }),
      headers: {
        authorization: `Bearer ${request.apiKey}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      ...(request.signal ? { signal: request.signal } : {}),
    })
  } catch (error) {
    throw new ProviderError(
      provider,
      'TRANSPORT',
      error instanceof Error ? error.message : 'Request failed.',
    )
  }

  if (!response.ok) {
    const detail = messageFromBody(await response.json().catch(() => null))

    throw new ProviderError(
      provider,
      codeForStatus(response.status, detail),
      detail === ''
        ? `${provider} answered ${String(response.status)}.`
        : `${provider} answered ${String(response.status)}: ${detail}`,
      response.status,
    )
  }

  const body = (await response.json().catch(() => null)) as ChatResponse | null
  const content = body?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new ProviderError(provider, 'INVALID_RESPONSE', 'The response carried no message content.')
  }

  return {
    data: parseJson(provider, content),
    model: typeof body?.model === 'string' ? body.model : request.model,
  }
}
