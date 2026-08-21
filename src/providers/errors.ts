export type ProviderErrorCode =
  | 'AUTH'
  | 'INVALID_RESPONSE'
  | 'MISSING_SDK'
  | 'RATE_LIMIT'
  | 'REFUSED'
  | 'TRANSPORT'

export class ProviderError extends Error {
  public readonly code: ProviderErrorCode

  public readonly provider: string

  public readonly status?: number

  constructor(
    provider: string,
    code: ProviderErrorCode,
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.code = code

    if (typeof status === 'number') {
      this.status = status
    }
  }
}

const AUTH_WORDING = /api[ _-]?key|unauthor|authenticat|credential|permission denied/i

/**
 * Reads the human readable message a provider put in its error body.
 * Covers the OpenAI shape (`error.message`), the Google shape (`error.message`
 * under a code and status) and a bare `message`.
 */
export const messageFromBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body.slice(0, 300)
  }

  if (body === null || typeof body !== 'object') {
    return ''
  }

  const record = body as Record<string, unknown>
  const error = record.error

  if (error !== null && typeof error === 'object') {
    const inner = (error as Record<string, unknown>).message

    if (typeof inner === 'string') {
      return inner.slice(0, 300)
    }
  }

  if (typeof error === 'string') {
    return error.slice(0, 300)
  }

  return typeof record.message === 'string' ? record.message.slice(0, 300) : ''
}

/**
 * Maps an HTTP status to a code. Gemini answers 400 with "API key not valid"
 * rather than 401, so the body is consulted before a 400 is called transport.
 */
export const codeForStatus = (status: number, message = ''): ProviderErrorCode => {
  if (status === 401 || status === 403) {
    return 'AUTH'
  }

  if (status === 429) {
    return 'RATE_LIMIT'
  }

  if (status === 400 && AUTH_WORDING.test(message)) {
    return 'AUTH'
  }

  return 'TRANSPORT'
}
