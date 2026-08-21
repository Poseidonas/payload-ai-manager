# payload-ai-manager

[![npm](https://img.shields.io/npm/v/payload-ai-manager?style=flat-square&color=0F766E)](https://www.npmjs.com/package/payload-ai-manager) ![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-6C757D?style=flat-square) ![payload](https://img.shields.io/badge/Payload-3.88+-0a0c0b?style=flat-square) ![ecommerce](https://img.shields.io/badge/plugin--ecommerce-3.88+-0a0c0b?style=flat-square)

**Claude, ChatGPT, Gemini and Kimi** for Payload. Writes product titles, descriptions, attribute lists and translations into the fields you name and no others, and refuses to pay for the same content twice.

- Four providers, selected from the admin panel: **Claude**, **ChatGPT**, **Gemini**, **Kimi**
- Automatic on save, or on demand through one endpoint
- Stores a fingerprint of what it generated, so unchanged content is never sent again
- The API key can live in an environment variable and never touch your database
- No runtime dependencies, and no admin components, so it survives Payload's minor releases

## What it writes

| `kind` | Output | Default `maxLength` |
| --- | --- | --- |
| `title` | A product title on one line. Names the product, not its benefits. No quotes, no trailing full stop. | 70 |
| `description` | A product description in plain prose. No headings, no markdown, no bullet points. | unlimited |
| `attributes` | An array of `Name: value` strings, only for attributes the source material supports. | unlimited |
| `translation` | The source material in the locale you name. Translates only — adds and removes nothing. | unlimited |

The 70 character default on `title` is where a product title stops being read in listings,
search results and browser tabs. Override it per target with `maxLength`.

## Turning a field off without a deploy

Every target gets a switch under **Fields to write** in the settings global, labelled with the
field and what is written into it. An editor can turn one off without touching the config or
redeploying. A target that is off is not sent to the model at all, and the content already in
that field is left exactly as it is — nothing is cleared.

Fields the plugin writes to carry a note under them in the edit view saying so. This is
Payload's `admin.description`, plain text rather than a custom component: components are the
part of the admin that changes between minor releases, and this plugin is built to survive
those untouched. A field that already has its own description keeps it.

## Compatibility

| Requirement | Version | Declared as |
| --- | --- | --- |
| `payload` | `>=3.88 <4` | peer dependency |
| `@payloadcms/plugin-ecommerce` | `>=3.88 <4` | peer dependency |
| `@anthropic-ai/sdk` | `>=0.60.0 <1` | **optional** peer dependency, needed only for Claude |
| Node | `>=20` | `engines` |

The floor is the version this package was actually tested against, not the oldest that might work. Verified end to end on Payload 3.88.0 with the official ecommerce plugin, on both PostgreSQL and MongoDB. When a newer version is verified the floor moves up and a release goes out.

## Install

Requires **Payload 3.88 or newer** and **`@payloadcms/plugin-ecommerce` 3.88 or newer**.

```bash
pnpm add payload-ai-manager
```

Claude is called through the official Anthropic SDK, which is an **optional** peer dependency. Install it only if you intend to use Claude:

```bash
pnpm add @anthropic-ai/sdk
```

ChatGPT, Gemini and Kimi are called over their REST APIs with `fetch` and need nothing installed. If Claude is selected while the SDK is absent, generation fails with a message telling you to install it; nothing crashes and no other provider is affected.

```ts
import { aiManagerPlugin } from 'payload-ai-manager'

export default buildConfig({
  plugins: [
    aiManagerPlugin({
      collections: {
        products: {
          sourceFields: ['title', 'brand', 'categories'],
          targets: [
            { field: 'title', kind: 'title' },
            { field: 'description', kind: 'description', maxLength: 600 },
            { field: 'attributes', kind: 'attributes' },
            { field: 'descriptionEl', kind: 'translation', locale: 'Greek' },
          ],
          auto: false,
        },
      },
    }),
  ],
})
```

Then open **AI Manager** in the admin panel, choose a provider, point it at a key, and switch generation on. Nothing is sent anywhere until you do.

## What was measured

Measured on 21 August 2026 against `@payloadcms/plugin-ecommerce` 3.88.0 and the npm registry.

| Question | Answer |
| --- | --- |
| Does the ecommerce plugin generate any content? | No. Nothing in it calls a model |
| Is there already an AI plugin for Payload? | Yes, `@ai-stack/payloadcms`, actively maintained |
| Does it support Kimi? | No. Its published files contain no reference to `moonshot` or `kimi` |
| Does it know the ecommerce plugin, or product attributes? | No. Neither term appears in it |
| Does it record what it already generated? | No fingerprint, no already-generated guard |
| How large is it? | 1.6 MB, with 19 files importing React |

That is the gap: four providers **including Kimi**, aimed at a product catalogue, refusing to regenerate content that has not changed, in about 24 kB with no React anywhere.

### Verified against the real endpoints

Every provider was called at its real endpoint with a deliberately invalid key. All four rejected the credential and nothing else, which means all four accepted the shape of the request.

| Provider | Response to an invalid key |
| --- | --- |
| Claude | `401 authentication_error`, "API key is invalid." |
| ChatGPT | `401`, "Incorrect API key provided" |
| Kimi | `401`, "Invalid Authentication" |
| Gemini | `400 INVALID_ARGUMENT`, "API key not valid." |

Gemini reports a bad key as **400**, not 401, so the error body is inspected before a 400 is classified. All four surface as an authentication failure carrying the provider's own wording.

The successful path was exercised against a local server answering in each vendor's response shape. No valid key has been used, so a successful generation from a real vendor has not been observed.

### Behaviour under stress

| Situation | Result |
| --- | --- |
| Model returns every field empty | Refused. Existing copy is left untouched |
| Model answers only some fields | Only those fields are written |
| Model returns text that is not JSON | Refused with `INVALID_RESPONSE` |
| Model returns 900 characters against a `maxLength` of 400 | Truncated to 400 |
| Provider returns 429 | Refused with `RATE_LIMIT` |
| Claude returns `stop_reason: refusal` | Refused with `REFUSED` |
| Provider takes 6 seconds, `auto` off | The save takes 0.06 seconds. It does not wait |
| Prompt injection in a source field | Stays in the user message. It never reaches the system prompt |
| `__proto__` in the model's JSON | No prototype pollution. Only configured targets are read |
| Endpoint called with no token, or a bad one | 403 |

## How it works

Both paths, automatic and manual, run through the same function. Six gates stand between a save and a paid API call, in this order:

1. The plugin is enabled and the collection is configured
2. Generation is switched on in the admin panel
3. A known provider is selected and a key resolves
4. At least one source field actually carries content
5. The fingerprint differs from the stored one, or `force` was passed
6. The model returned something usable

Failing any of the first five is a `skipped` with a reason. Failing the sixth is a `failed`. Neither ever leaves a document half written.

### Why it does not regenerate

Every generated document stores a fingerprint: a SHA-256 over the source field values **and** the target definitions, truncated to 32 characters.

Including the targets matters. Change your instructions, add a target or alter a locale, and the fingerprint changes, so the document is regenerated even though the product itself did not change.

The hash is stable in the ways that would otherwise cause false work. Key order does not affect it at any depth. A relationship counts as its id, so reading a document at depth 0 or depth 2 produces the same answer. A field that is absent and a field set to `null` are the same thing.

### The prompt

The system prompt is assembled from your targets: one line per field, worded differently for each kind — prose for a description, `Name: value` for attributes, translate-only for a translation. Above them sit the rules against invention. Below them, your house style.

The user message contains only the source fields you named. Whatever a catalogue editor typed stays there and is never promoted into the system prompt.

### The automatic path

The `afterChange` hook marks `req.context` before saving its result, and returns early when it sees that mark. One save produces one API call, not a loop. A failure is logged and the save proceeds: losing generated copy is better than losing the document.

## Providers

| Provider | Transport | Request shape | Default model |
| --- | --- | --- | --- |
| Claude | Official SDK, imported dynamically | `output_config.format` with a JSON schema, `thinking: adaptive` | `claude-opus-5` |
| ChatGPT | `fetch` | `response_format.json_schema`, `strict: true` | `gpt-4.1` |
| Kimi | `fetch`, same code as ChatGPT | identical, different base URL | `kimi-k2-0905-preview` |
| Gemini | `fetch` | `responseSchema`, with `additionalProperties` stripped | `gemini-2.5-flash` |

Kimi's API is OpenAI compatible, so it reuses that client with `https://api.moonshot.ai/v1`. Mainland China users set the base URL to `https://api.moonshot.cn/v1`. Gemini rejects `additionalProperties`, so that keyword is removed for Gemini only.

Every provider is asked for a JSON object matching a schema built from your targets, with all of them `required`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `collections` | required | Which collections take part, keyed by slug |
| `collections[slug].sourceFields` | required | Fields read to build the prompt. A missing one is skipped, not an error |
| `collections[slug].targets` | required | Fields written. At least one |
| `collections[slug].auto` | `false` | Generate on create, and whenever the source fields change |
| `disabled` | `false` | Stops generation, leaves fields and settings in place |
| `maxOutputTokens` | `2048` | Upper bound per request |
| `settingsSlug` | `'ai-manager'` | Slug of the settings global |
| `statusField` | `'aiStatus'` | Name of the group recording what was generated |

Each target takes:

| Field | Required | Meaning |
| --- | --- | --- |
| `field` | yes | The field written. Dot paths are not supported |
| `kind` | yes | `description`, `attributes` or `translation` |
| `locale` | for `translation` | The target language, in words |
| `instructions` | no | Extra wording appended for this target only |
| `maxLength` | no | Applied to the result, not requested from the model |

A value that cannot be used is replaced by its default rather than applied: a negative `maxLength` becomes no limit, a `maxOutputTokens` of `0` becomes `2048`, and `4096.9` becomes `4096`. A target with an unknown `kind`, or a translation with no locale, is dropped rather than guessed at. A collection left without a usable target takes no part at all.

## What it adds to your database

| Where | Field | Notes |
| --- | --- | --- |
| each configured collection | `aiStatus` group | `generatedAt`, `provider`, `model`, `fields`, and a hidden indexed `fingerprint` |
| new global `ai-manager` | provider, model, key, base URL, house style | Appears in the admin menu under Ecommerce |

The settings are an ordinary Payload global, which is why they appear in the menu without this package shipping a single React component.

## Settings and keys

The global carries two key fields, and the order matters.

**API key environment variable** holds the *name* of an environment variable. It is read at request time and never stored. This is the recommended field.

**API key** is the fallback, used only when the variable is empty or unset. It is written to your database in clear text, and its read access is closed, so neither REST nor GraphQL ever returns it. It exists because a shop owner without deploy access still needs a way in.

The **House style** field is appended to every prompt. Use it to say how the shop speaks, what to avoid, and which claims are not permitted.

## Endpoint

```
POST /api/ai-manager/generate
{ "collection": "products", "id": 42, "force": false }
```

Requires an authenticated user, and reads the document with the caller's own access rights. `force: true` ignores the fingerprint.

| Response | Meaning |
| --- | --- |
| `{"status":"generated","fields":[...]}` | Written. `fields` lists what changed |
| `{"status":"skipped","reason":"..."}` | Nothing sent. Reason is `disabled`, `not-configured`, `no-source` or `unchanged` |
| `{"status":"failed","reason":"..."}` | The provider or its answer failed. HTTP 502, prefixed with a code such as `AUTH` or `RATE_LIMIT` |

## Honest limits

**No successful generation from a real vendor has been observed.** Every provider has been reached at its real endpoint and has accepted the shape of the request, but only with an invalid key. The successful path was exercised against a local recording server. Treat your first run with a real key as the real test.

**Simultaneous requests for the same document each cost a call.** Every Payload request runs in its own transaction, so requests fired at the same instant cannot see each other's uncommitted fingerprint: measured, five simultaneous calls produced five provider requests instead of one. Sequential requests deduplicate correctly, and that is the path a save or a button click takes. If you drive the endpoint from a script, serialise it.

**A model can still be wrong.** The prompt forbids inventing specifications and asks for an empty field rather than filler when the source is too thin. It cannot forbid a plausible sentence that happens to be false. Copy for a regulated product should be read before it is published.

**Automatic mode costs money on every source change.** It is off by default and stays off until you enable it per collection. The fingerprint prevents repeat work, not first work.

**With `auto` enabled, a save waits for the provider.** For a bulk import, leave `auto` off and drive the endpoint yourself.

**Model names go stale.** Providers retire models. Set the model field explicitly if a default stops resolving.

**Changing `settingsSlug` or `statusField` later is a schema change.** On PostgreSQL, Payload will ask how to migrate the renamed enum and table, and a non-interactive deploy will stall waiting for that answer. Decide both names before the first deploy, or run the migration deliberately.

**One field, one value.** Dot paths are not supported, so a target inside a group or an array cannot be addressed. Rich text fields receive plain strings.

## License

MIT. Copyright George Vasiliades, https://github.com/Poseidonas
