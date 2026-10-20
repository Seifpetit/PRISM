<!-- MAP-SCHEMA:8 -->
<!-- CONTROL-ROOM-PROVENANCE:{"agentVersion":"1.3.0","basedOnMapRevision":2,"createdByRunId":"MAP-74D583F7","definitionHash":"da9289fe8febdec7d032927f52c89e6ee096e85e996a971517e2d4eacb0e0de1","doctrineId":"maintenance-doctrine","doctrineVersion":"1.6.0","repositoryId":"68612d49-1f3d-4d4c-8dc9-0d1343af7ffc","repositorySignature":"sha256:b36e6580379d8b81526ec2048894a12ddb68a2dc77ad4459220dfaaee6d0208f","verification":"verified"} -->

# Codebase Map

This file is the canonical zone map. Active zones and areas are stored exactly
once in bounded blocks so they can be appended, found, updated, or removed
without synchronizing another index.

<!-- LIVE-STATUS:START -->
## Live Work Status

| Agent | State | Progress | Current scope | Last result | Updated (UTC) |
| --- | --- | --- | --- | --- | --- |
| `mapper` | `idle` | `Map [####################] 28/28; Readability [--------------------] 0/28` | `none` | `r1 inventory created: 3 zones, 28 areas mapped; no source zoning edits yet; next readability area BE-01` | `2026-10-08` |
| `extractor` | `not_started` | `[--------------------] 0/28` | `none` | `Map available` | `2026-10-08` |
| `guardian` | `not_started` | `[--------------------] 0/28` | `none` | `Map available` | `2026-10-08` |

<!-- LIVE-STATUS:END -->

## Artifact editing contract

- Create a zone immediately before the standalone `ZONES:END` marker line.
- Create an area immediately before its owning zone's end marker.
- Read or update the complete bounded block.
- Delete a complete bounded block; never renumber surviving IDs.
- Artifact deletion does not delete source code.
- Record every create, update, or delete in the change log.

## Copyable area template

```md
<!-- AREA:{AREA_ID}:START -->
### {AREA_ID} - {Area name}

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `{paths}` |
| Excludes | `{exclusions}` |
| Purpose | {purpose} |
| Public surfaces | {surfaces} |
| Dependencies / consumers | {dependencies} |
| Role | `{role}` |
| Role evidence | {evidence} |
| Uncertainty | {uncertainty} |
| Verification | {tests} |
| Next action | {next action} |

#### Blocks and chunks

- {block or chunk}

#### Structure candidates and blockers

- {candidate or `none`}

<!-- AREA:{AREA_ID}:END -->
```

## Repository-wide exclusions

Not owned by any area: `node_modules/`, `.next/`, `npm-cache-tmp/`, `logs/`,
`.devlogs/`, `.agents/`, `.claude/`, `tsconfig.tsbuildinfo`, `.env`,
`data/prism.db`, `data/prism.db-wal`, `data/prism.db-shm`,
`data/ai-cost-ledger.jsonl`, and root-level media/sample files (`*.csv`,
`*.mp4`, `*.png`, `*.pdf` at the repository root).

## Active zones

<!-- ZONES:START -->
<!-- ZONE:BE:START -->
## BE - Backend GraphQL server

| Field | Value |
| --- | --- |
| Root | `backend/` |
| Purpose | Node ESM GraphQL server (graphql-yoga), AI orchestration, SQLite persistence, and third-party integrations |
| Area prefix | `BE` |

<!-- AREA:BE-01:START -->
### BE-01 - Server entry and GraphQL schema

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/server.mjs`; `backend/schema.mjs` |
| Excludes | all `backend/*/` subdirectories |
| Purpose | Boots the backend, runs migrations, defines GraphQL type definitions and resolvers, and hosts OAuth callback routes |
| Public surfaces | GraphQL schema (`typeDefs`); HTTP OAuth install/callback handlers |
| Dependencies / consumers | Imports nearly every backend area; consumed by `api/http.ts` via GraphQL |
| Role | `entry_point` |
| Role evidence | `package.json` script `backend` runs `backend/server.mjs`; `backend/server.mjs` imports `backend/database/migrate.mjs:runDatabaseMigrations` |
| Entry points | `backend/server.mjs` (http) |
| Depends on | `BE-02` via `backend/server.mjs` imports `backend/ai/model-gateway.mjs`; `BE-04` via `backend/server.mjs` imports `backend/ai-cost-tracker/index.mjs`; `BE-05` via `backend/server.mjs` imports `backend/database/operation-log-api.mjs`; `BE-06` via `backend/server.mjs` imports `backend/product-context/service.mjs`; `BE-07` via `backend/server.mjs` imports `backend/url-inspection/index.mjs`; `BE-08` via `backend/server.mjs` imports `backend/integrations/meta-ads.mjs`; `BE-09` via `backend/server.mjs` imports `backend/context-library/extract.mjs`; `BE-10` via `backend/server.mjs` imports `backend/csv-import/service.mjs`; `BE-11` via `backend/server.mjs` imports `backend/pipeline/service.mjs`; `BE-03` via `backend/server.mjs` imports `backend/creative-exploration/ad-thumbnails.mjs` |
| Used by | `FE-13` via `api/http.ts` (GraphQL HTTP request builder) |
| Uncertainty | resolver size and internal grouping of `backend/server.mjs` not yet read |
| Verification | `node --check backend/server.mjs`; GraphQL tests in `backend/database/campaigns-graphql.test.mjs`, `backend/context-library/context-library-graphql.test.mjs` |
| Next action | Read `backend/server.mjs` and add resolver-group section labels only |

#### Blocks and chunks

- Imports; server bootstrap; resolvers; OAuth routes (not yet chunked)

#### Structure candidates and blockers

- shared file `backend/server.mjs` spans `BE-01`, `BE-03`, `BE-08`, `BE-10` (resolver logic for many domains in one file; unverified size)

<!-- AREA:BE-01:END -->

<!-- AREA:BE-02:START -->
### BE-02 - AI gateway, providers, and core prompts

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/ai/canonical-caller.mjs`; `backend/ai/model-gateway.mjs`; `backend/ai/prompt-catalog.mjs`; `backend/ai/workflow-operations.mjs`; `backend/ai/providers/`; `backend/ai/input-templates/`; `backend/ai/output-schemas/` |
| Excludes | `backend/ai/modes/` |
| Purpose | Canonical AI call boundary, provider adapters (OpenAI, Anthropic, DeepSeek, Gemini, Perplexity, OpenAI image), model listing, prompt catalog/overrides, and Product Context template/schema |
| Public surfaces | `listAiModels`; `inputTemplates`; prompt catalog read/save; workflow operation constants |
| Dependencies / consumers | Uses `BE-04` cost tracking and `BE-05` operation logging at the canonical caller (per `AGENTS.md`); consumed by `BE-01`, `BE-03`, `BE-06` |
| Role | `gateway` |
| Role evidence | `backend/ai/providers/` contains per-provider adapters; `AGENTS.md` names `backend/ai/canonical-caller.mjs` as the canonical AI-call boundary |
| Entry points | `backend/ai/model-gateway.mjs:listAiModels` (export); `backend/ai/prompt-catalog.mjs:listPromptCatalog` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/ai/input-templates/index.mjs` |
| Uncertainty | direct imports from canonical caller into `BE-04`/`BE-05` taken from `AGENTS.md`, not yet traced in source |
| Verification | `npm.cmd run test:ai-cost` |
| Next action | Zone `backend/ai/canonical-caller.mjs` phases with section labels |

#### Blocks and chunks

- Canonical caller; provider adapters; templates; schemas; prompt catalog

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-02:END -->

<!-- AREA:BE-03:START -->
### BE-03 - Creative exploration generation

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/ai/modes/creative-exploration/`; `backend/creative-exploration/` |
| Excludes | none |
| Purpose | Angles, offers, target avatars, ad hooks, and ad-plan templates/schemas/output parsers; service orchestration; avatar images and ad thumbnails |
| Public surfaces | `normalizeAdPlanOptions`; `generateAdThumbnail`; `generateAdSetThumbnails`; `ensureAvatarImages`; `avatarImageStatuses` |
| Dependencies / consumers | Uses `BE-02` and `BE-05`; consumed by `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/ai/modes/creative-exploration/input-templates/` and `backend/ai/modes/creative-exploration/output-schemas/` define generation contracts |
| Entry points | `backend/creative-exploration/service.mjs` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/creative-exploration/avatar-images.mjs` |
| Uncertainty | working tree deletes the creative-directions template/schema; area contents are mid-change |
| Verification | `npm.cmd run test:creative-exploration`; `npm.cmd run test:target-avatar` |
| Next action | Zone `backend/creative-exploration/service.mjs` after in-flight changes settle |

#### Blocks and chunks

- Templates; schemas; output parsers; service; image/thumbnail generators; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-03:END -->

<!-- AREA:BE-04:START -->
### BE-04 - AI cost tracker

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/ai-cost-tracker/` |
| Excludes | `data/ai-cost-ledger.jsonl` (runtime ledger) |
| Purpose | Normalize provider usage, price it from structured snapshots, and append ledger rows |
| Public surfaces | `readCostLedgerEntriesForApi` and tracker exports in `backend/ai-cost-tracker/index.mjs` |
| Dependencies / consumers | Reads pricing JSON owned by `RG-03`; consumed by `BE-02` and `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/ai-cost-tracker/normalizers/`, `backend/ai-cost-tracker/calculators/`, `backend/ai-cost-tracker/ledger/file-ledger.mjs` |
| Entry points | `backend/ai-cost-tracker/index.mjs` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/ai-cost-tracker/index.mjs` |
| Uncertainty | pricing-snapshot load path from `docs/provider-pricing/providers/` not traced in source this pass |
| Verification | `npm.cmd run test:ai-cost` |
| Next action | Zone `backend/ai-cost-tracker/index.mjs` |

#### Blocks and chunks

- Normalizers; calculators; pricing loaders; ledger writer; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-04:END -->

<!-- AREA:BE-05:START -->
### BE-05 - SQLite database and repositories

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/database/` |
| Excludes | `data/prism.db`, `data/prism.db-wal`, `data/prism.db-shm` |
| Purpose | `node:sqlite` client, numbered migrations, workspace-scoped repositories (auth, campaigns, pipeline, CSV imports, integrations, notes, operation logs), payload sanitization, token crypto |
| Public surfaces | Repository exports; `runDatabaseMigrations`; `readOperationLogsForApi`; CLI scripts `db:create`, `db:migrate`, `db:import-cost-ledger` |
| Dependencies / consumers | Consumed by most backend areas |
| Role | `storage` |
| Role evidence | `backend/database/client.mjs`; `backend/database/migrations/001_operation_logs.sql` through `backend/database/migrations/025_target_avatar_images.sql` |
| Entry points | `backend/database/create-database.mjs` (cli); `backend/database/migrate.mjs` (cli); `backend/database/import-cost-ledger.mjs` (cli) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/database/operation-log-repository.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:database` |
| Next action | Zone the largest repository after a size survey |

#### Blocks and chunks

- Client; migrations; repositories; sanitizer/crypto; CLI scripts; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-05:END -->

<!-- AREA:BE-06:START -->
### BE-06 - Product context synthesis

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/product-context/` |
| Excludes | none |
| Purpose | Build the Product Context artifact from normalized sources and generate product images |
| Public surfaces | `buildProductContextArtifact`; `generateProductImage`; `ProductContextDomainError` |
| Dependencies / consumers | Uses `BE-02`; consumed by `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/product-context/service.mjs`; `backend/product-context/source-normalization.mjs` |
| Entry points | `backend/product-context/service.mjs:buildProductContextArtifact` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/product-context/service.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:product-context` |
| Next action | Zone `backend/product-context/service.mjs` |

#### Blocks and chunks

- Service; source normalization; media capabilities; schema; errors; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-06:END -->

<!-- AREA:BE-07:START -->
### BE-07 - Product URL inspection

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/url-inspection/` |
| Excludes | none |
| Purpose | Fetch/render product pages and classify/score product candidates |
| Public surfaces | `inspectProductUrl` |
| Dependencies / consumers | Uses `playwright-core` (per `package.json`); consumed by `BE-01` |
| Role | `gateway` |
| Role evidence | `backend/url-inspection/fetch-page.mjs`; `backend/url-inspection/render-page.mjs` |
| Entry points | `backend/url-inspection/index.mjs:inspectProductUrl` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/url-inspection/index.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:url-inspection` |
| Next action | Zone `backend/url-inspection/inspect-product-url.mjs` |

#### Blocks and chunks

- Fetch/render; HTML parsing; signals; scoring; classification policy; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-07:END -->

<!-- AREA:BE-08:START -->
### BE-08 - External integrations

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/integrations/` |
| Excludes | none |
| Purpose | OAuth and API clients for Meta Ads, Shopify, Google Drive, Converty, Pexels, and exchange rates; Meta publishing |
| Public surfaces | OAuth start/callback handlers; performance readers; `publishConceptToMeta`; `disconnectIntegration` |
| Dependencies / consumers | Uses `BE-05` integration-connection storage; consumed by `BE-01` |
| Role | `gateway` |
| Role evidence | `backend/integrations/meta-oauth.mjs`; `backend/integrations/shopify-oauth.mjs`; `backend/integrations/meta-publish.mjs` |
| Entry points | `backend/integrations/meta-oauth.mjs:startMetaInstall` (http); `backend/integrations/shopify-oauth.mjs:startShopifyInstall` (http) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/integrations/meta-performance.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:exchange-rates`; `backend/integrations/converty.test.mjs` |
| Next action | Zone `backend/integrations/meta-performance.mjs` |

#### Blocks and chunks

- Per-provider OAuth; per-provider data clients; disconnect; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-08:END -->

<!-- AREA:BE-09:START -->
### BE-09 - Context library

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/context-library/` |
| Excludes | none |
| Purpose | Extract text from uploaded context sources and assemble generation context |
| Public surfaces | `ContextSourceError`; service and assemble exports |
| Dependencies / consumers | Uses `BE-05` context-sources repository; consumed by `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/context-library/extract.mjs`; `backend/context-library/assemble.mjs` |
| Entry points | `backend/context-library/service.mjs` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/context-library/extract.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:context-library` |
| Next action | Zone `backend/context-library/service.mjs` |

#### Blocks and chunks

- Extraction; assembly; service; fixtures; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-09:END -->

<!-- AREA:BE-10:START -->
### BE-10 - CSV import and data library

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/csv-import/`; `backend/data-library/` |
| Excludes | none |
| Purpose | Parse/resolve ad-performance CSV imports and manage workspace data items |
| Public surfaces | `analyzeCsvImport`; `commitCsvImport`; `squash`; data-item CRUD (`addDataItem`, `saveDataItem`, ...) |
| Dependencies / consumers | Uses `BE-05`; consumed by `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/csv-import/parse.mjs`; `backend/data-library/service.mjs` |
| Entry points | `backend/csv-import/service.mjs` (export); `backend/data-library/service.mjs` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/csv-import/service.mjs` |
| Uncertainty | CSV import and data library share no verified code; may deserve separate areas |
| Verification | `backend/database/csv-import.test.mjs` (via `npm.cmd run test:database`) |
| Next action | Confirm ownership split, then zone `backend/csv-import/service.mjs` |

#### Blocks and chunks

- CSV parse; CSV resolve; CSV service; data-library service

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-10:END -->

<!-- AREA:BE-11:START -->
### BE-11 - Production pipeline service

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `backend/pipeline/` |
| Excludes | none |
| Purpose | Pipeline task create/update/move/delete rules |
| Public surfaces | `createPipelineTask`; `updatePipelineTask`; `movePipelineTask`; `deletePipelineTask`; `listPipelineTasks`; `PipelineError` |
| Dependencies / consumers | Uses `BE-05` pipeline repository; consumed by `BE-01` |
| Role | `domain_module` |
| Role evidence | `backend/pipeline/service.mjs` |
| Entry points | `backend/pipeline/service.mjs` (export) |
| Used by | `BE-01` via `backend/server.mjs` imports `backend/pipeline/service.mjs` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run test:pipeline` |
| Next action | Zone `backend/pipeline/service.mjs` |

#### Blocks and chunks

- Service; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:BE-11:END -->
<!-- ZONE:BE:END -->

<!-- ZONE:FE:START -->
## FE - Next.js frontend

| Field | Value |
| --- | --- |
| Root | `app/`, `components/`, `lib/`, `store/`, `api/`, `services/`, `types/`, `graph/`, `hooks/`, `modes/`, `styles/`, `public/`, `data/` (TS/JSON only) |
| Purpose | Next.js 16 / React 19 client application: product workbench, strategy canvas, campaigns, creatives, performance, pipeline, settings |
| Area prefix | `FE` |

<!-- AREA:FE-01:START -->
### FE-01 - App entry and shell chrome

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `app/layout.tsx`; `app/page.tsx`; `app/icon.png`; `app/icon1.png`; `components/app-shell.tsx`; `components/app-header.tsx`; `components/theme-provider.tsx`; `components/demo-sign-in.tsx`; `components/onboarding-header.tsx`; `components/control-accent-sync.tsx`; `components/drawer-pages.tsx`; `components/notes-button.tsx` |
| Excludes | `app/globals.css` (`FE-02`) |
| Purpose | Root layout/page, application shell, header, theme control, sign-in, and global drawers |
| Public surfaces | Next.js route `/`; `ThemeControl` |
| Dependencies / consumers | Composes feature areas `FE-03` through `FE-11` |
| Role | `entry_point` |
| Role evidence | `app/layout.tsx`, `app/page.tsx` (Next.js app router entry) |
| Entry points | `app/page.tsx` (ui) |
| Uncertainty | composition of feature views by `components/app-shell.tsx` not traced this pass |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/app-shell.tsx` |

#### Blocks and chunks

- Layout/page; shell; header; theme; drawers

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-01:END -->

<!-- AREA:FE-02:START -->
### FE-02 - Styles and static assets

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `app/globals.css`; `styles/`; `public/`; `tailwind.config.ts`; `postcss.config.mjs` |
| Excludes | none |
| Purpose | Design tokens, Prism effects (`.prism-contour`, `.prism-anchor-action`), legacy dark-mode compatibility, Tailwind config, static assets |
| Public surfaces | CSS classes and custom properties |
| Dependencies / consumers | Consumed by all `FE` UI areas |
| Role | `ui` |
| Role evidence | `styles/tokens.css`; `styles/features.css` |
| Uncertainty | `public/` contents not inventoried this pass |
| Verification | `npm.cmd run build` |
| Next action | Add section labels to `styles/features.css` |

#### Blocks and chunks

- Tokens; base; primitives; features; legacy

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-02:END -->

<!-- AREA:FE-03:START -->
### FE-03 - Strategy canvas and lineage

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/strategy-canvas.tsx`; `components/strategy-node.tsx`; `components/strategy-prism-edge.tsx`; `components/focused-strategy-node.tsx`; `components/avatar-node.tsx`; `components/avatar-link-edge.tsx`; `components/avatar-detail-panel.tsx`; `components/lineage-breadcrumb.tsx`; `components/lineage-grammar.tsx`; `components/lineage-inspector.tsx`; `components/generation-satellites.tsx`; `components/ingredient-plus.tsx`; `components/ingredient-prompt-inspector.tsx`; `components/target-avatar-inspector.tsx`; `components/target-avatar-tray.tsx`; `components/target-avatar-tray.test.mjs`; `components/persona-photo.tsx`; `components/gender-icon.tsx`; `components/strategy-nodes/`; `components/motion-primitives/`; `graph/`; `modes/` |
| Excludes | none |
| Purpose | React Flow strategy/creative-exploration canvas, node and edge renderers, lineage inspector, avatar tray, focus dialog, and child-generation animation |
| Public surfaces | `StrategyCanvas`; `animateChildGeneration` |
| Dependencies / consumers | Uses `FE-04`, `FE-13`; `@xyflow/react`, `motion` |
| Role | `ui` |
| Role evidence | `components/strategy-canvas.tsx`; `graph/animations/animate-child-generation.ts` |
| Uncertainty | some root `components/*.tsx` files assigned here by name and `AGENTS.md` description, not import trace |
| Verification | `npm.cmd run typecheck`; `npm.cmd run test:target-avatar` |
| Next action | Zone `components/strategy-canvas.tsx` without touching React Flow state wiring |

#### Blocks and chunks

- Canvas; node renderers; edges; inspectors; avatar tray; animation; mode definition

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-03:END -->

<!-- AREA:FE-04:START -->
### FE-04 - Generation controls

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/generation-control.tsx`; `components/provider-model-selector.tsx`; `components/prism-action.tsx` |
| Excludes | none |
| Purpose | Shared `GenerationControl -> ProviderModelSelector -> PrismAction` generation surface |
| Public surfaces | `GenerationControl`; `ProviderModelSelector`; `PrismAction` |
| Dependencies / consumers | Consumed by `FE-03`, `FE-05`, and drawers (per `AGENTS.md`) |
| Role | `ui` |
| Role evidence | `AGENTS.md` names `components/generation-control.tsx` as the shared generation surface |
| Uncertainty | consumer list from `AGENTS.md`, not import trace |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/prism-action.tsx` |

#### Blocks and chunks

- Control; selector; action

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-04:END -->

<!-- AREA:FE-05:START -->
### FE-05 - New product workbench

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/new-product/` |
| Excludes | none |
| Purpose | Product Workbench stages: material intake, context build/review, testing and integrations |
| Public surfaces | `ProductWorkbench`; `EmptyProduct`; `MaterialIntake` |
| Dependencies / consumers | Uses `FE-04`, `FE-13`, `FE-14` |
| Role | `ui` |
| Role evidence | `components/new-product/product-workbench.tsx`; `components/new-product/material-intake.tsx` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/new-product/empty-product.tsx` |

#### Blocks and chunks

- Workbench; intake; build context; testing/integrations

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-05:END -->

<!-- AREA:FE-06:START -->
### FE-06 - Campaigns

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/campaign/` |
| Excludes | none |
| Purpose | Campaign canvas pages, ad sets, composer modal, concept drawer, ad editor, Meta publish dialog |
| Public surfaces | `CampaignPages`; `NewCampaignButton`; `ComposerDrawer` |
| Dependencies / consumers | Uses `FE-13` (`store/campaign-slice.ts`), `FE-14` (`lib/campaign-rules.ts`) |
| Role | `ui` |
| Role evidence | `components/campaign/campaign-pages.tsx`; `components/campaign/composer-drawer.tsx` |
| Uncertainty | dependency on store/lib inferred from names, not traced |
| Verification | `npm.cmd run typecheck`; `npm.cmd run test:campaign-rules` |
| Next action | Zone after the in-flight `rework/campaigns-creatives` branch changes settle |

#### Blocks and chunks

- Pages; flow nodes/edges; composer; drawers; editor; publish

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-06:END -->

<!-- AREA:FE-07:START -->
### FE-07 - Creatives workspace

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/creatives/`; `components/integrations/`; `components/creative-thumbnail.tsx` |
| Excludes | none |
| Purpose | Creatives workspace: ad cards/drawer/brief, cover images, send to pipeline, save to Google Drive |
| Public surfaces | `CreativesWorkspace` |
| Dependencies / consumers | Uses `FE-13`; links to `FE-10` |
| Role | `ui` |
| Role evidence | `components/creatives/creatives-workspace.tsx` |
| Uncertainty | `components/creative-thumbnail.tsx` and `components/integrations/google-drive-picker.tsx` assigned here by name; consumers not traced |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/creatives/creatives-workspace.tsx` |

#### Blocks and chunks

- Workspace; ad card/drawer; pipeline/drive actions

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-07:END -->

<!-- AREA:FE-08:START -->
### FE-08 - Generation setup

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/generation-setup/` |
| Excludes | none |
| Purpose | Generation Setup UI over the context library: add/list sources and preview assembled context |
| Public surfaces | `GenerationSetup`; `useContextLibrary` |
| Dependencies / consumers | Uses `FE-13` (`store/generation-setup-store.ts`), `FE-14` (`lib/generation-setup.ts`) |
| Role | `ui` |
| Role evidence | `components/generation-setup/generation-setup.tsx` |
| Uncertainty | dependencies inferred from names |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/generation-setup/generation-setup.tsx` |

#### Blocks and chunks

- Setup; add source; source list; preview; hook

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-08:END -->

<!-- AREA:FE-09:START -->
### FE-09 - Performance views

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/performance/` |
| Excludes | none |
| Purpose | Meta/Shopify/imported-ad performance tables, charts, currency control, and integration status |
| Public surfaces | `PerformanceView` |
| Dependencies / consumers | Uses `FE-13` (`services/performance.ts`), `FE-14` metrics/currency libs |
| Role | `ui` |
| Role evidence | `components/performance/performance-view.tsx` |
| Uncertainty | dependencies inferred from names |
| Verification | `npm.cmd run typecheck`; `npm.cmd run test:meta-metrics` |
| Next action | Zone `components/performance/performance-view.tsx` |

#### Blocks and chunks

- View; sections; tables/charts; currency; sync chips

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-09:END -->

<!-- AREA:FE-10:START -->
### FE-10 - Pipeline board UI

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/pipeline/` |
| Excludes | none |
| Purpose | Production pipeline board and task drawer |
| Public surfaces | `PipelineView`; `TaskDrawer` |
| Dependencies / consumers | Uses `FE-13` (`store/pipeline-store.ts`), `FE-14` (`lib/pipeline.ts`) |
| Role | `ui` |
| Role evidence | `components/pipeline/pipeline-view.tsx` |
| Uncertainty | dependencies inferred from names |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `components/pipeline/pipeline-view.tsx` |

#### Blocks and chunks

- Board; task drawer

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-10:END -->

<!-- AREA:FE-11:START -->
### FE-11 - Settings

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/settings/` |
| Excludes | none |
| Purpose | Settings shell: profile, AI prompts, cost ledger, operations logs, integrations, data library editors, CSV import, user notes |
| Public surfaces | `SettingsShell` |
| Dependencies / consumers | Uses `FE-13` services (`services/cost-ledger.ts`, `services/operation-logs.ts`) |
| Role | `ui` |
| Role evidence | `components/settings/settings-shell.tsx` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run typecheck`; `npm.cmd run test:frontend` (`components/settings/data-editors/grid-format.test.ts`) |
| Next action | Zone `components/settings/operations-logs-section.tsx` |

#### Blocks and chunks

- Shell; sections; data editors

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-11:END -->

<!-- AREA:FE-12:START -->
### FE-12 - Shared UI primitives

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `components/ui/`; `components/confirmation-dialog.tsx`; `hooks/` |
| Excludes | none |
| Purpose | Modal, select, surface, toolbar, tray, textarea primitives; confirmation dialog; click-outside hook |
| Public surfaces | `Modal`; `Select`; `Surface`; `ConfirmationDialog`; `useClickOutside` |
| Dependencies / consumers | Consumed by feature UI areas |
| Role | `shared_utility` |
| Role evidence | `components/ui/modal.tsx`; `hooks/use-click-outside.ts` |
| Uncertainty | none recorded |
| Verification | `npm.cmd run typecheck` |
| Next action | Likely `not_applicable` for zoning if files are small; confirm sizes |

#### Blocks and chunks

- Primitives; dialog; hooks

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-12:END -->

<!-- AREA:FE-13:START -->
### FE-13 - Client state, API client, and types

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `api/`; `services/`; `store/`; `types/`; `data/ai-providers.ts`; `data/mock.ts` |
| Excludes | `data/prism.db*`; `data/ai-cost-ledger.jsonl`; `data/product-source-capabilities.json` (`FE-14`) |
| Purpose | GraphQL HTTP client, typed service wrappers, Zustand stores, shared frontend types, provider list and mock data |
| Public surfaces | `api/api.ts` functions; `useAppStore`; service modules |
| Dependencies / consumers | Calls `BE-01` GraphQL; consumed by all `FE` feature areas |
| Role | `gateway` |
| Role evidence | `api/api.ts` imports `api/http.ts:buildGraphQLHttpRequest` and `sendHttpRequest` |
| Entry points | `api/api.ts` (export); `store/use-app-store.ts` (export) |
| Depends on | `FE-14` via `api/api.ts` imports type from `lib/campaign-rules.ts` |
| Uncertainty | stores could be split into a separate `stateful_service` area later |
| Verification | `npm.cmd run typecheck` |
| Next action | Zone `api/api.ts` by domain sections |

#### Blocks and chunks

- HTTP; API functions; services; stores; types; static data

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-13:END -->

<!-- AREA:FE-14:START -->
### FE-14 - Shared domain logic library

| Field | Value |
| --- | --- |
| Readability | `mapped` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `lib/`; `data/product-source-capabilities.json` |
| Excludes | none |
| Purpose | Pure rules and formatters: campaign/merger rules, ad-plan options, metrics, currency, pipeline, lineage, product-source capability catalog |
| Public surfaces | Module exports under `lib/` |
| Dependencies / consumers | Consumed by `FE` feature areas and `FE-13` |
| Role | `shared_utility` |
| Role evidence | `lib/campaign-rules.ts`; `lib/product-source-capabilities.ts` |
| Used by | `FE-13` via `api/api.ts` imports `lib/campaign-rules.ts` |
| Uncertainty | whether backend imports `data/product-source-capabilities.json` not traced |
| Verification | `npm.cmd run test:campaign-rules`; `npm.cmd run test:meta-metrics` |
| Next action | Zone the largest `lib/` module after a size survey |

#### Blocks and chunks

- Campaign rules; metrics; currency; pipeline; lineage; capabilities; tests

#### Structure candidates and blockers

- none recorded

<!-- AREA:FE-14:END -->
<!-- ZONE:FE:END -->

<!-- ZONE:RG:START -->
## RG - Repository governance and tooling

| Field | Value |
| --- | --- |
| Root | repository root |
| Purpose | Build/test configuration, guidance documents, and canonical provider pricing data |
| Area prefix | `RG` |

<!-- AREA:RG-01:START -->
### RG-01 - Build, lint, and test configuration

| Field | Value |
| --- | --- |
| Readability | `not_applicable` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `package.json`; `package-lock.json`; `tsconfig.json`; `next.config.ts`; `next-env.d.ts`; `eslint.config.mjs`; `.prettierrc.json`; `vitest.config.ts`; `test/`; `.gitignore`; `.env.example` |
| Excludes | `.env`; `tsconfig.tsbuildinfo` |
| Purpose | npm scripts, TypeScript/Next/ESLint/Prettier/Vitest configuration, frontend test setup |
| Public surfaces | npm scripts (`dev`, `backend`, `db:*`, `test:*`, `build`, `typecheck`) |
| Dependencies / consumers | Governs all zones |
| Role | `tooling` |
| Role evidence | `package.json` scripts |
| Uncertainty | none recorded |
| Verification | `npm.cmd run typecheck`; `npm.cmd run lint` |
| Next action | none (configuration; not zoned) |

#### Blocks and chunks

- Config files

#### Structure candidates and blockers

- none

<!-- AREA:RG-01:END -->

<!-- AREA:RG-02:START -->
### RG-02 - Guidance and strategy docs

| Field | Value |
| --- | --- |
| Readability | `not_applicable` |
| Structure scan | `not_applicable` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `AGENTS.md`; `README.md`; `CONTEXT_SUMMARY.md`; `docs/creative-strategy/`; `docs/codebase-map.md` |
| Excludes | `docs/provider-pricing/` (`RG-03`) |
| Purpose | Agent handoff guidance, project readme, creative strategy framework, this map |
| Public surfaces | Documentation |
| Dependencies / consumers | Read by agents and developers |
| Role | `governance` |
| Role evidence | `AGENTS.md` (project instructions) |
| Uncertainty | none recorded |
| Verification | none |
| Next action | none |

#### Blocks and chunks

- Documents

#### Structure candidates and blockers

- none

<!-- AREA:RG-02:END -->

<!-- AREA:RG-03:START -->
### RG-03 - Provider pricing snapshots

| Field | Value |
| --- | --- |
| Readability | `not_applicable` |
| Structure scan | `mapped` |
| Structure checked | `never` |
| Structure fingerprint | `not_recorded` |
| Structure report | `not_recorded` |
| Enforcement status | `not_started` |
| Enforcement checked | `never` |
| Enforcement baseline | `not_recorded` |
| Rule entropy | `70` |
| Enforcement report | `not_recorded` |
| Enforcement verification | `not_recorded` |
| Enforcement next action | Run the mandatory cost preflight and select this area when prioritized |
| Paths | `docs/provider-pricing/` |
| Excludes | none |
| Purpose | Canonical structured pricing JSON per provider plus explanatory Markdown |
| Public surfaces | `docs/provider-pricing/providers/*.json` |
| Dependencies / consumers | Consumed by `BE-04` (per `AGENTS.md`) |
| Role | `governance` |
| Role evidence | `AGENTS.md` states structured JSON under `docs/provider-pricing/` is canonical |
| Uncertainty | runtime-data files living under `docs/`; owner could arguably be `BE-04` |
| Verification | `npm.cmd run test:ai-cost` |
| Next action | none (data-only; not zoned) |

#### Blocks and chunks

- Provider JSON snapshots; Markdown notes

#### Structure candidates and blockers

- runtime pricing data stored under `docs/` rather than with `BE-04`; record only, do not move

<!-- AREA:RG-03:END -->
<!-- ZONE:RG:END -->
<!-- ZONES:END -->

## Retired map entries

None.

## Verification baseline

- r1 (2026-10-08): inventory built from directory listings and import lines of
  `backend/server.mjs` and `api/api.ts`. No tests run; no source edited.

## Change log

| Date | Operation | ID | Summary |
| --- | --- | --- | --- |
| 2026-10-08 | create | BE, BE-01..BE-11 | Created backend zone and 11 areas |
| 2026-10-08 | create | FE, FE-01..FE-14 | Created frontend zone and 14 areas |
| 2026-10-08 | create | RG, RG-01..RG-03 | Created governance/tooling zone and 3 areas |
