import { chatCompletion } from './openai-compatible.js'
import type { Provider } from './types.js'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export const openaiProvider: Provider = {
  consoleUrl: 'https://platform.openai.com/api-keys',
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModel: 'gpt-4.1',
  generate: (request) =>
    chatCompletion('openai', request.baseUrl || DEFAULT_BASE_URL, request),
  id: 'openai',
  label: 'ChatGPT',
}
