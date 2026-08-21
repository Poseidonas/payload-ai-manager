import type { ProviderId } from './providers/types.js'

export type TargetKind = 'attributes' | 'description' | 'title' | 'translation'

export type TargetConfig = {
  /** Field the generated value is written to. Dot paths are not supported. */
  field: string
  /** What to ask the model for. */
  kind: TargetKind
  /** Extra wording appended to the system prompt for this target only. */
  instructions?: string
  /** Target locale, required when kind is 'translation'. */
  locale?: string
  /** Maximum characters. Applied to the result, not requested from the model.
   *  Defaults to 70 for `title`, which is where product titles stop being read
   *  in listings and search results. Unlimited for every other kind. */
  maxLength?: number
}

export type CollectionConfig = {
  /** Run automatically when a document is created or its source fields change. */
  auto?: boolean
  /** Fields read to build the prompt. A missing field is skipped, not an error. */
  sourceFields: string[]
  /** Fields written. At least one is required. */
  targets: TargetConfig[]
}

export type AiManagerConfig = {
  /** Which collections take part, keyed by slug. */
  collections: Record<string, CollectionConfig>
  /** Stops all generation while leaving fields and settings in place. */
  disabled?: boolean
  /** Upper bound on output tokens per request. Defaults to 2048. */
  maxOutputTokens?: number
  /** Name of the field group holding the record of what was generated. */
  statusField?: string
  /** Slug of the settings global. Defaults to 'ai-manager'. */
  settingsSlug?: string
}

export type ResolvedTarget = Required<Pick<TargetConfig, 'field' | 'kind'>> & {
  instructions: string
  locale: string
  maxLength: number
}

export type ResolvedCollection = {
  auto: boolean
  sourceFields: string[]
  targets: ResolvedTarget[]
}

export type ResolvedConfig = {
  collections: Record<string, ResolvedCollection>
  disabled: boolean
  maxOutputTokens: number
  settingsSlug: string
  statusField: string
}

export type Settings = {
  /** Target switches, keyed by `targetKey(slug, field)`. Missing means enabled. */
  targets: Record<string, boolean>
  apiKey: string
  apiKeyEnv: string
  baseUrl: string
  enabled: boolean
  model: string
  provider: ProviderId
  tone: string
}
