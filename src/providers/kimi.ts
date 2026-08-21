import { chatCompletion } from './openai-compatible.js'
import type { Provider } from './types.js'

const DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1'

export const kimiProvider: Provider = {
  consoleUrl: 'https://platform.moonshot.ai/console/api-keys',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModel: 'kimi-k2-0905-preview',
  generate: (request) =>
    chatCompletion('kimi', request.baseUrl || DEFAULT_BASE_URL, request),
  id: 'kimi',
  label: 'Kimi',
}
