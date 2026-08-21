import type { Config, Field } from 'payload'

import { resolveConfig } from './config.js'
import { generateEndpoint } from './endpoints.js'
import { autoGenerate } from './hooks.js'
import { settingsGlobal } from './settings.js'
import { statusGroup } from './status.js'
import type { AiManagerConfig, ResolvedCollection } from './types.js'

export { fingerprint } from './fingerprint.js'
export { providerIds, providers } from './providers/index.js'
export { ProviderError } from './providers/errors.js'
export type { Provider, ProviderId } from './providers/types.js'
export type {
  AiManagerConfig,
  CollectionConfig,
  TargetConfig,
  TargetKind,
} from './types.js'

/**
 * Note on a field that the plugin writes to it.
 *
 * This is `admin.description`, which Payload renders as plain text under the field.
 * A custom component would give a richer marker, but it would also be the one thing
 * this plugin avoids: components are the part of Payload's admin that changes between
 * minor releases, and a broken one takes the whole edit view with it. An existing
 * description is left alone rather than overwritten.
 */
const markTargets = (
  fields: Field[],
  collection: ResolvedCollection,
  settingsSlug: string,
): Field[] => {
  const byField = new Map(collection.targets.map((target) => [target.field, target]))

  return fields.map((field) => {
    const name = 'name' in field ? field.name : undefined
    const target = typeof name === 'string' ? byField.get(name) : undefined

    if (target === undefined) {
      return field
    }

    const admin = (field as { admin?: Record<string, unknown> }).admin ?? {}

    if (admin.description !== undefined) {
      return field
    }

    const what =
      target.kind === 'translation' ? `translation into ${target.locale}` : target.kind

    return {
      ...field,
      admin: {
        ...admin,
        description: `Written by AI Manager as a ${what}. Turn it off in ${settingsSlug} settings.`,
      },
    } as Field
  })
}

export const aiManagerPlugin =
  (incoming: AiManagerConfig) =>
  (incomingConfig: Config): Config => {
    const config = resolveConfig(incoming)
    const slugs = Object.keys(config.collections)

    if (slugs.length === 0) {
      return incomingConfig
    }

    const collections = (incomingConfig.collections ?? []).map((collection) => {
      if (!slugs.includes(collection.slug)) {
        return collection
      }

      const resolved = config.collections[collection.slug]

      if (resolved === undefined) {
        return collection
      }

      const hooks = collection.hooks ?? {}

      return {
        ...collection,
        fields: [
          ...markTargets(collection.fields, resolved, config.settingsSlug),
          statusGroup(config),
        ],
        hooks: {
          ...hooks,
          afterChange: [...(hooks.afterChange ?? []), autoGenerate(config, collection.slug)],
        },
      }
    })

    return {
      ...incomingConfig,
      collections,
      endpoints: [...(incomingConfig.endpoints ?? []), generateEndpoint(config)],
      globals: [...(incomingConfig.globals ?? []), settingsGlobal(config)],
    }
  }
