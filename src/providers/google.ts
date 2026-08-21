import { parseJson } from './anthropic.js'
import { codeForStatus, messageFromBody, ProviderError } from './errors.js'
import type { Provider, ProviderRequest, ProviderResult } from './types.js'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[]
}

const stripUnsupported = (schema: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}

  for (const key of Object.keys(schema)) {
    if (key !== 'additionalProperties') {
      out[key] = schema[key]
    }
  }

  return out
}

const generate = async (request: ProviderRequest): Promise<ProviderResult> => {
  const base = (request.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const url = `${base}/models/${encodeURIComponent(request.model)}:generateContent`
  let response: Response

  try {
    response = await fetch(url, {
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.prompt }], role: 'user' }],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: stripUnsupported(request.schema),
        },
        systemInstruction: { parts: [{ text: request.system }] },
      }),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': request.apiKey,
      },
      method: 'POST',
      ...(request.signal ? { signal: request.signal } : {}),
    })
  } catch (error) {
    throw new ProviderError(
      'google',
      'TRANSPORT',
      error instanceof Error ? error.message : 'Request failed.',
    )
  }

  if (!response.ok) {
    const detail = messageFromBody(await response.json().catch(() => null))

    throw new ProviderError(
      'google',
      codeForStatus(response.status, detail),
      detail === ''
        ? `Gemini answered ${String(response.status)}.`
        : `Gemini answered ${String(response.status)}: ${detail}`,
      response.status,
    )
  }

  const body = (await response.json().catch(() => null)) as GenerateResponse | null
  const parts = body?.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')

  return { data: parseJson('google', text), model: request.model }
}

export const googleProvider: Provider = {
  consoleUrl: 'https://aistudio.google.com/apikey',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModel: 'gemini-2.5-flash',
  generate,
  id: 'google',
  label: 'Gemini',
}
