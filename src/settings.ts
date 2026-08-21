import type { Field, GlobalConfig } from 'payload'

import { providerIds, providers } from './providers/index.js'
import type { ProviderId } from './providers/types.js'
import type { ResolvedConfig, ResolvedTarget, Settings } from './types.js'

const providerOptions = providerIds.map((id) => ({
  label: providers[id].label,
  value: id,
}))

const keyDescription = providerIds
  .map((id) => `${providers[id].label}: ${providers[id].consoleUrl}`)
  .join(' — ')

/** Field name for a target's switch. Payload field names allow no punctuation. */
export const targetKey = (slug: string, field: string): string =>
  `${slug}__${field}`.replace(/[^A-Za-z0-9_]/gu, '_')

const targetLabel = (target: ResolvedTarget): string => {
  if (target.kind === 'translation') {
    return `${target.field} — translation into ${target.locale}`
  }

  return `${target.field} — ${target.kind}`
}

/** One switch per target, so an editor can turn a field off without a deploy. */
const targetFields = (config: ResolvedConfig): Field[] =>
  Object.entries(config.collections).flatMap(([slug, collection]) =>
    collection.targets.map((target) => ({
      name: targetKey(slug, target.field),
      type: 'checkbox' as const,
      admin: { description: `Collection: ${slug}` },
      defaultValue: true,
      label: targetLabel(target),
    })),
  )

export const settingsGlobal = (config: ResolvedConfig): GlobalConfig => ({
  slug: config.settingsSlug,
  admin: {
    description:
      'Which model writes your content, and with which key. Prefer the environment variable field: a key typed here is stored in the database.',
    group: 'Ecommerce',
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Generation enabled',
    },
    {
      name: 'provider',
      type: 'select',
      defaultValue: 'anthropic',
      options: providerOptions,
      required: true,
    },
    {
      name: 'model',
      type: 'text',
      admin: {
        description: 'Leave empty to use the default model of the selected provider.',
      },
    },
    {
      name: 'apiKeyEnv',
      type: 'text',
      admin: {
        description: `Name of an environment variable holding the key. Read at request time and never stored. ${keyDescription}`,
      },
      label: 'API key environment variable',
    },
    {
      name: 'apiKey',
      type: 'text',
      access: { read: () => false },
      admin: {
        description:
          'Only used when the environment variable above is empty. Stored in the database in clear text, and never returned by the API.',
      },
      label: 'API key',
    },
    {
      name: 'baseUrl',
      type: 'text',
      admin: {
        description:
          'Override the provider endpoint. Kimi users in mainland China: https://api.moonshot.cn/v1',
      },
      label: 'Base URL',
    },
    {
      name: 'tone',
      type: 'textarea',
      admin: {
        description: 'Added to every prompt. Say how the shop speaks, what to avoid, which claims are not allowed.',
      },
      label: 'House style',
    },
    {
      name: 'targets',
      type: 'group',
      admin: {
        description:
          'Which fields the model writes. Switching one off leaves its content untouched; nothing is deleted.',
      },
      fields: targetFields(config),
      label: 'Fields to write',
    },
  ],
  label: 'AI Manager',
})

export const readSettings = (value: unknown): Settings => {
  const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const provider = record.provider

  const targets = record.targets
  const switches: Record<string, boolean> = {}

  if (targets !== null && typeof targets === 'object') {
    for (const [key, value] of Object.entries(targets as Record<string, unknown>)) {
      switches[key] = value !== false
    }
  }

  return {
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
    apiKeyEnv: typeof record.apiKeyEnv === 'string' ? record.apiKeyEnv : '',
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : '',
    enabled: record.enabled === true,
    model: typeof record.model === 'string' ? record.model : '',
    provider: providerIds.includes(provider as ProviderId)
      ? (provider as ProviderId)
      : 'anthropic',
    targets: switches,
    tone: typeof record.tone === 'string' ? record.tone : '',
  }
}

export const resolveApiKey = (
  settings: Settings,
  env: Record<string, string | undefined>,
): string => {
  if (settings.apiKeyEnv !== '') {
    const fromEnv = env[settings.apiKeyEnv]

    if (typeof fromEnv === 'string' && fromEnv !== '') {
      return fromEnv
    }
  }

  return settings.apiKey
}
