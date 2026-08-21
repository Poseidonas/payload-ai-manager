import type {
  AiManagerConfig,
  CollectionConfig,
  ResolvedCollection,
  ResolvedConfig,
  ResolvedTarget,
  TargetConfig,
  TargetKind,
} from './types.js'

const KINDS: TargetKind[] = ['attributes', 'description', 'title', 'translation']

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback

const positive = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.trunc(value)

  return rounded > 0 ? rounded : fallback
}

const uniqueStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim() !== '') {
      seen.add(entry.trim())
    }
  }

  return [...seen]
}

// Where a product title stops being read in listings, search results and tabs.
const TITLE_MAX_LENGTH = 70

const resolveTarget = (target: TargetConfig): null | ResolvedTarget => {
  const field = text(target.field, '')
  const kind = KINDS.includes(target.kind) ? target.kind : null

  if (field === '' || kind === null) {
    return null
  }

  const locale = text(target.locale, '')

  if (kind === 'translation' && locale === '') {
    return null
  }

  return {
    field,
    instructions: text(target.instructions, ''),
    kind,
    locale,
    maxLength: positive(target.maxLength, kind === 'title' ? TITLE_MAX_LENGTH : 0),
  }
}

const resolveCollection = (incoming: CollectionConfig): null | ResolvedCollection => {
  const sourceFields = uniqueStrings(incoming.sourceFields)
  const targets: ResolvedTarget[] = []
  const used = new Set<string>()

  for (const target of Array.isArray(incoming.targets) ? incoming.targets : []) {
    const resolved = resolveTarget(target)

    if (resolved !== null && !used.has(resolved.field)) {
      used.add(resolved.field)
      targets.push(resolved)
    }
  }

  if (sourceFields.length === 0 || targets.length === 0) {
    return null
  }

  return { auto: incoming.auto === true, sourceFields, targets }
}

export const resolveConfig = (incoming: AiManagerConfig): ResolvedConfig => {
  const collections: Record<string, ResolvedCollection> = {}

  for (const [slug, value] of Object.entries(incoming.collections ?? {})) {
    const resolved = resolveCollection(value)

    if (resolved !== null) {
      collections[slug] = resolved
    }
  }

  return {
    collections,
    disabled: incoming.disabled === true,
    maxOutputTokens: positive(incoming.maxOutputTokens, 2048),
    settingsSlug: text(incoming.settingsSlug, 'ai-manager'),
    statusField: text(incoming.statusField, 'aiStatus'),
  }
}
