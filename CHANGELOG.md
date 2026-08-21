# Changelog

All notable changes to this package are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this package
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-21

### Added

- Product descriptions, attribute lists and translations written by **Claude, ChatGPT, Gemini or
  Kimi**, into named fields only. `@payloadcms/plugin-ecommerce` generates no content of any kind,
  and the one maintained AI plugin for Payload supports neither Kimi nor product attributes.
- **A fingerprint that stops repeat work.** A SHA-256 over the source values and the target
  definitions is stored with every generated document and checked before any provider is called, so
  unchanged content is never paid for twice. Key order does not affect it at any depth, a
  relationship counts as its id so read depth does not either, and changing your instructions does
  cause a rerun. Nothing comparable exists in the alternative.
- **Settings in the admin menu without an admin component.** The configuration is an ordinary
  Payload global, so it appears in the menu on its own. Admin React components are where
  third-party Payload packages break on minor releases, and this package ships none.
- Automatic generation per collection, off by default, plus `POST /api/ai-manager/generate` for
  manual runs with an optional `force` that ignores the fingerprint.
- Two ways to supply a key, in a deliberate order: the name of an environment variable, read at
  request time and never stored, or a stored key used only when that is empty. The stored field has
  its read access closed, so no API returns it.
- Claude is called through the official Anthropic SDK, declared as an **optional** peer dependency
  so it is installed only by shops that choose Claude. The other three are plain `fetch` against
  their REST APIs. The package has no runtime dependencies.
- A prompt that forbids inventing specifications and asks for an empty field rather than filler
  when the source material is too thin, and a result stage that never overwrites existing copy with
  an empty answer.

### Fixed

- **A bad key on Gemini was reported as a transport failure.** Gemini answers an invalid key with
  `400 INVALID_ARGUMENT` rather than 401, so it fell through to the generic branch and the shop
  owner was told the network had failed. The error body is now read and a 400 whose message speaks
  about keys, authentication or permission is classified as `AUTH`, like every other provider.
- **The REST providers threw away the vendor's message.** A failure said only "openai answered 401"
  while the vendor had explained exactly what was wrong. The message is now extracted from the
  error body — the OpenAI shape, the Google shape and a bare `message` — capped at 300 characters
  so a large body cannot flood a log.

- The manual endpoint answered `Unknown collection` for a collection it had just listed as valid.
  Payload does not populate `req.data` in a custom endpoint; the body has to be parsed with
  `addDataAndFileToRequest` first, which is what `plugin-ecommerce` does in its own endpoints.
  Found by running the endpoint, not by a unit test — the tests call the handler with `req.data`
  already set, so they could not have caught it.

### Notes

- No provider was called during development; every test mocks the transport. Request shapes come
  from each provider's documented API. This is stated in the README rather than left to be
  discovered.
- Declares `@payloadcms/plugin-ecommerce` as a peer dependency even though it imports nothing from
  it, because it is aimed at the product collections that plugin creates and metadata that says
  otherwise leaves tooling unable to determine compatibility.
- Peer floor is `>=3.88`, the version actually tested, not the oldest that might work.
- **`kind: 'title'`** — product titles, capped at 70 characters by default, which is where a
  title stops being read in listings and search results.
- **A switch per target in settings**, under *Fields to write*. An editor can stop the model
  writing to a field without a deploy. A target that is off is never sent to the model, and the
  content already in the field is left untouched.
- **A note on every field the plugin writes to**, through Payload's `admin.description`. Plain
  text rather than a custom component, so nothing breaks when Payload's admin changes between
  minor releases. A field that already has a description keeps it.
