# Prism / ECOM Codex Handoff

Last updated: 2026-08-12

This file is the working handoff for future Codex sessions. Preserve the decisions below unless the
user explicitly changes them.

## Product and visual principles

- Structure stays neutral; Prism color represents active transformation, generation, selection, and
  lineage.
- Do not broadly recolor or redesign the application. Prism is intentionally concentrated in the
  logo, `PrismAction`, active processing, and graph-generation moments.
- `PrismAction` is reserved for AI synthesis/generation. Utility actions such as adding URLs, notes,
  files, selecting providers/models, editing, fixing, saving, and canceling remain neutral.
- Product Context is an inferred artifact until the user confirms the Product Identity. Strategy
  expansion must remain gated behind that confirmation.
- Provider/model selection is infrastructure UI and must remain visually neutral.

## Work completed in this session

### AI cost tracking

- Added the centralized `backend/ai-cost-tracker/` vertical slices for OpenAI, DeepSeek, and Gemini.
- Provider usage is normalized and priced at the canonical AI-call boundary in
  `backend/ai/canonical-caller.mjs`.
- Ledger records are append-only and include provider/model, semantic operation, request and
  generation IDs, raw/normalized usage, pricing snapshot, breakdown, and exact decimal USD cost.
- Every successful persisted row logs once from the centralized ledger writer:
  `console.log("[AI COST LEDGER]", entry)`.
- Unknown or unsupported pricing is `unpriced`/`partial`; it must never silently become zero.
- Stable workflow operations live in `backend/ai/workflow-operations.mjs`.
- Current cost implementations do not include Anthropic or Perplexity.

### Product-source ingestion and model compatibility

- Product intake combines document, image, and video material in one UI ingestion surface, while URL
  and notes remain separate inputs.
- Extraction/provider feeding is routed by source format; product features do not manually feed
  providers.
- Model/source compatibility is centralized in `lib/product-source-capabilities.ts` and
  `data/product-source-capabilities.json`.
- Unsupported models are visibly disabled/locked. Hover explains the incompatibility.
- Adding incompatible material automatically chooses the configured least-expensive compatible
  fallback model and reports the change.
- Models without the structured-output contract required by Product Context are excluded rather than
  allowed to fail at runtime.
- Do not infer capabilities from pricing alone. Keep the explicit capability catalog accurate when
  models change.

### Shared generation UI

- `components/generation-control.tsx` is the shared generation surface.
- Component hierarchy is `GenerationControl -> ProviderModelSelector -> PrismAction`.
- Product Context build/update and Strategy drawer generation use this shared control.
- Keep graph animation outside `GenerationControl`.

### Product Context UI

- Product Intake, synthesis loading, and Product Context Review received localized Prism styling.
- Review is organized around Product Identity confirmation, a compact "What Prism found" snapshot,
  progressive disclosure for full fields, and a confirmation-gated strategy CTA.
- The loading view uses a presentation-level synthesis timeline; do not present it as exact backend
  telemetry.
- Product Context review remains an auditable document, not a dashboard.

### Strategy graph behavior

- The graph uses stable geometry during generation. Do not animate graph coordinates, viewport, pan,
  zoom, or React Flow's positioned node wrapper.
- The product root is anchored. All non-product nodes are draggable.
- Dragging uses React Flow local node-change state and commits the coordinate only on drag-stop. Do
  not rebuild the full controlled node array on every pointer movement; that previously made all
  nodes disappear.
- Manually moved coordinates are kept in `StrategyCanvas` local state for subsequent generations,
  but are not persisted across reloads.
- Newly generated children are assigned final collision-free positions before reveal. Existing and
  manually moved nodes are treated as occupied space.
- Initial workspace framing uses React Flow's one-time `fitView` prop. Generation must never call
  `fitView`, recenter, pan, or zoom.
- `graph/animations/animate-child-generation.ts` owns the reusable successful-child reveal:
  `animateChildGeneration({ parentNodeId, childNodeIds, childEdgeIds, duration?, onComplete? })`.
- Canonical children mount once at final coordinates. The animation uses temporary port flare,
  bloom, ghost outlines, and opacity/stroke resolution only.
- Animation failure, cancellation, selection change, or unmount must reveal valid canonical children
  and clean temporary overlays.
- The parent Prism perimeter runs locally inside the node card. Never update the complete React Flow
  node array on every animation frame; that also previously caused disappearing nodes.

### Audience generation v2

- `backend/ai/input-templates/audiences.template.mjs` is now `audiences-v2`.
- Audience output remains `{ items: [{ label: string }] }`; persisted `StrategyNode` shape is
  unchanged.
- `backend/ai/output-schemas/audiences.schema.mjs` accepts 2-6 items.
- The prompt now maximizes useful audience coverage up to six. It explicitly must not stop at two or
  three by default.
- Non-overlap and Product Context grounding are the stopping rules. Use all six slots when six
  defensible, distinct territories exist.
- `backend/server.mjs` retains up to six parsed items only for `audiences`; all later lineage stages
  remain capped at two.
- The no-AI fallback currently returns two audiences, which remains schema-valid.

## Important implementation warnings

- React Flow is sensitive to full controlled-node-array replacement during continuous animation or
  dragging. Keep high-frequency visual state inside node/overlay DOM, and use `useNodesState` for
  drag changes.
- Never remove/re-add canonical nodes merely to animate them.
- Never animate node `x`, `y`, React Flow wrapper transforms, edge geometry, or the camera during
  generation.
- Keep `animateChildGeneration` swappable and node-type agnostic.
- Do not parse pricing Markdown at runtime. Structured JSON under `docs/provider-pricing/` is
  canonical.
- Do not duplicate provider/model controls in individual drawers.
- Do not derive semantic AI operations by inspecting prompt text.

## Validation completed

- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test:ai-cost` passes all 15 tests.
- Audience JSON Schema validation confirms 2 and 6 are valid; 1 and 7 are invalid.
- Backend Audience template/schema/server files pass `node --check`.

## Recommended next-session work

1. Manually smoke-test the complete Strategy graph interaction in a browser: generate 2-6 audiences,
   drag several nodes, generate descendants, cancel/close during reveal, trigger an error, and
   verify no nodes disappear or move unexpectedly.
2. Add deterministic frontend tests for React Flow generation and dragging regressions, especially
   the two historical disappearing-node failures.
3. Decide whether manually arranged graph coordinates should persist across reloads/products; if
   yes, add the smallest appropriate frontend or backend persistence contract in a separate task.
4. Improve generated-child collision placement using measured React Flow node dimensions rather than
   approximate per-type dimensions, while preserving stable geometry.
5. Live-test `audiences-v2` across narrow and broad Product Context examples. Confirm it returns
   broad non-overlapping coverage and does not default to two.
6. Add focused Audience template/schema/parser tests, including preservation of 3-6 returned items
   and continued two-item behavior for later lineage stages.
7. Complete the Anthropic AI cost-tracking vertical slice, then Perplexity, using the same canonical
   call-boundary invariant and official pricing snapshots.
8. Review and update the model capability catalog against current provider documentation, especially
   structured outputs, image/document/video support, and retired model IDs.
9. Add backend-derived Product Identity confidence and field/source provenance when contracts are
   intentionally expanded; remove frontend defaults/TODOs afterward.
10. Add a production configuration gate for `[AI COST LEDGER]` console logging while keeping
    development logging centralized and once-per-entry.
11. Consider intelligent minimal viewport reveal for off-screen generated children only as a
    separate UX task. Do not couple it to the current generation animation without explicit
    approval.

## Session update — 2026-08-12

### Strategy graph presentation

- Audience cards now prioritize `label`, awareness level, and compact `definingNeed` metadata.
  Richer Audience fields remain primarily in the Lineage Inspector.
- Product cards now prefer `workingLabel`, show `category` as lightweight metadata, and retain the
  factual `name` when it differs meaningfully. Missing fields fall back safely without rendering
  `undefined`, `null`, or empty rows.
- Audience inspector details include awareness, defining need, context, product relevance, messaging
  direction, awareness rationale, and supported-by evidence when available.
- Product Context review uses `workingLabel` as the marketer-facing identity, preserves factual
  `name`, displays `category`, and hides zero-count summary categories without removing underlying
  arrays.
- Product Context reasoning now permits high-confidence category-obvious inference while requiring
  evidence for product-specific claims, performance, medical, prestige, superiority, and other
  special claims.

### Child generation animation

- `graph/animations/animate-child-generation.ts` now begins with a temporary parent charging/release
  treatment before revealing generated children. It preserves stable React Flow geometry and cleans
  up temporary overlays on completion, cancellation, selection change, and unmount.
- The parent charge is local DOM/CSS visual state. Do not animate graph coordinates, viewport,
  edges, or the controlled node array frame-by-frame.
- The earlier left-side beam experiment was removed. The intended language is: parent is charged by
  Prism energy, shakes/builds intensity, then releases energy into the normal child Prism reveal.

### Prism contours

- `components/strategy-node.tsx` uses `PrismNodeContour` for selected and generation/preload states.
- `app/globals.css` reuses the Generate button's conic gradient and `prism-action-contour-cycle`
  keyframes. Selected nodes use a slower/lower-intensity contour; generation state is stronger and
  more active.
- The contour is a single masked perimeter with `border-radius: inherit`, `pointer-events: none`,
  and no layout effect. Its apparent stroke thickness is selected at `app/globals.css:160` with
  `padding: 1px`.
- The old SVG perimeter was removed because its `preserveAspectRatio="none"` caused non-uniform
  apparent stroke thickness on card aspect ratios.
- Selected nodes use a neutral base border so the old light-blue selected focus border does not
  stack with the Prism contour. Lineage/path accents remain intact. Reduced-motion mode disables
  cycling and holds a static contour.

### Generation-control bug diagnosis and fix

- The disabled Generate button was rendered by `components/prism-action.tsx`; its effective
  expression was `disabled || pending || committing`.
- `committing` was local PrismAction state. It stayed true after the external generation callback
  because the component remained mounted while selection moved to a generated child.
- Clicking empty canvas unmounted the inspector and PrismAction, which reset `committing`; that
  explained why clicking away appeared to fix the issue.
- The fix clears `committing` in the completion timer before invoking the external callback and
  clears the timer on unmount. Do not reintroduce a canvas-click workaround.

### Historical backend/frontend state mismatch — resolved

- This described the pre-SQLite implementation. Strategy nodes are now loaded from the active
  workspace’s SQLite records, and generated nodes plus drag-stop coordinates persist across backend
  restarts. Keep `requireParent()` strict as a workspace-isolation guard.

### Validation completed this session

- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- Existing Product Context and AI-cost tests passed during the related implementation work.
- Browser automation was not available for manual graph smoke testing in this environment, so visual
  interaction validation remains a recommended follow-up.

### Likely next-session features

1. Add a clear frontend/backend strategy synchronization path after backend restart or GraphQL
   parent-validation failure, while preserving strict parent validation.
2. Decide and implement the smallest persistence contract for generated strategy nodes if strategy
   state must survive backend reloads.
3. Add deterministic component/store tests for generation completion, selected-child eligibility,
   PrismAction timer cleanup, and stale-node recovery.
4. Manually smoke-test the complete graph flow with 2–6 audiences, descendant generation, selection
   changes, cancellation, reduced motion, and error recovery.
5. Add visual regression coverage for uniform selected/preload contours, rounded clipping, no layout
   shift, and preservation of lineage accents.
6. Consider measuring actual React Flow node dimensions for collision placement rather than relying
   on approximate per-type dimensions.

## Session update — 2026-08-14

### Audience morphing focus

- Added the reusable `components/focused-strategy-node.tsx` abstraction backed by the Motion
  Primitives Morphing Dialog mechanics in `components/motion-primitives/morphing-dialog.tsx`.
- Audience is the first and only node type migrated. First click preserves graph selection/drawer
  behavior; a deliberate second click focuses the selected Audience. Pointer movement suppresses
  dialog opening after a drag.
- Expanded Audience content lives in `components/strategy-nodes/audience-node-content.tsx` and
  conditionally renders only actual node data: need, context, product relevance, strategy, evidence,
  and lineage.
- Focus is a portal layer only. It does not change React Flow geometry, camera, selection, drawer
  behavior, satellites, generation, or generation animation.
- Added the `motion` package. Dialog behavior includes shared-layout morphing, restrained backdrop,
  Escape/outside close, focus trap/return, background inerting, scroll lock, and reduced-motion
  handling.

### Settings architecture and observability

- Settings navigation contains `Profile`, `AI prompts`, `Cost ledger`, and `Operations logs` in
  `components/settings/settings-shell.tsx`. The prompt editor is an infrastructure surface, not a
  generation control.
- Profile remains its own essentially unchanged section.
- Cost Ledger reads the existing AI ledger and presents provider/model/operation summaries and
  recent activity without recalculating cost.
- Operations Logs now has an additive `operationLogs(limit:)` GraphQL query and an operation-level
  frontend model instead of flattening each cost row into a separate operation.
- The readable frontend is in `components/settings/operations-logs-section.tsx`. Expanded rows have
  distinct sections for operation overview, validated input, provider attempts, request, normalized
  response, optional sanitized raw response, usage/cost, flags/errors, validated output, final
  error, and related Prism objects.
- Operations Logs typography was increased for readability. Historical rows are explicitly labeled
  `Untraced`; the UI must never imply that missing payloads or duration were captured.
- `backend/database/operation-log-api.mjs` falls back to grouping JSONL cost rows into untraced
  logical operations when PostgreSQL is unavailable. This is why the current frontend still shows
  `Untraced`.

### PostgreSQL operation database implementation

- Added the `pg` dependency and PostgreSQL infrastructure under `backend/database/`.
- Schema migration: `backend/database/migrations/001_operation_logs.sql`.
- Four tables are defined:
  - `operations`: one logical Prism operation and its final status/error/relations.
  - `operation_attempts`: each provider/integration attempt, including retry number, options,
    duration, provider/model, status, and errors.
  - `operation_payloads`: logical and attempt input/output artifacts with
    captured/untraced/redacted/blocked state.
  - `operation_costs`: exact decimal cost, normalized/raw usage, pricing snapshot, and breakdown.
- Historical JSONL import is idempotent. Missing historical input/output and duration are
  represented by payload rows with `trace_status = 'untraced'` and null content; they are not
  fabricated.
- New canonical AI calls capture sanitized provider-neutral input, normalized response, sanitized
  raw provider response, duration, provider errors, retry attempts, and cost without modifying
  provider adapters.
- Validated strategy outputs and Product Context outputs are attached at the workflow boundary after
  validation. Failed validation updates the logical operation error state.
- Payload sanitization happens before persistence. Authorization/cookie/API-key/password/token
  fields, signed URL credentials, and embedded base64 binary data are redacted. Tests live in
  `backend/database/sanitize-payload.test.mjs`.
- JSONL remains a transitional append-only fallback and cost rows dual-write to PostgreSQL only when
  `DATABASE_URL` is configured. A database failure must not change AI generation semantics; JSONL
  remains available for reconciliation.
- Existing `costLedger(limit:)` GraphQL clients remain compatible. When configured, its resolver
  reads PostgreSQL and falls back to JSONL on database read failure.
- Setup commands and behavior are documented in `backend/database/README.md`:
  - `npm.cmd run db:create`
  - `npm.cmd run db:migrate`
  - `npm.cmd run db:import-cost-ledger`

### Current PostgreSQL blocker — important

- PostgreSQL 18 is installed locally and the Windows service `postgresql-x64-18` is running.
- The server requires password authentication. A passwordless connection as `postgres` was rejected
  with `fe_sendauth: no password supplied`.
- No PostgreSQL credentials were invented, recovered, or changed.
- `.env` currently does **not** contain `DATABASE_URL`, `POSTGRES_ADMIN_URL`, or
  `PRISM_DATABASE_NAME`.
- Consequently `isDatabaseConfigured()` returns false, canonical operation tracing intentionally
  no-ops, and the `operationLogs` GraphQL resolver serves the JSONL fallback. Restarting the backend
  alone cannot enable PostgreSQL.
- The currently visible Audience operation around `2026-08-14T14:08:00.817Z` was written only to
  JSONL while PostgreSQL was disabled. Even after later import it must remain `Untraced`, because
  its payloads and duration never existed.
- Do not put a fake placeholder password into `.env`; it will not authenticate against the installed
  server. There is no universal PostgreSQL default password.
- To continue, the user must either provide the existing PostgreSQL credential locally or
  authorize/reset the local `postgres` password. Do not ask the user to paste a password into chat.
- Preferred final setup: authenticate once as the PostgreSQL administrator, create a dedicated
  least-privilege `prism` role/database, put its connection URL in local `.env`, run
  create/migrate/import, restart the backend, then generate a brand-new operation and verify
  captured payloads.
- Required local configuration shape:
  - `POSTGRES_ADMIN_URL=postgresql://postgres:<local-password>@localhost:5432/postgres`
  - `PRISM_DATABASE_NAME=prism`
  - `DATABASE_URL=postgresql://<dedicated-prism-user>:<local-password>@localhost:5432/prism`
  - `DATABASE_SSL=false`
- After configuration, verify database counts for all four tables and verify that a newly generated
  operation has captured logical input/output, attempt request/response, duration, status, cost, and
  relations. Historical imported records should remain untraced.

### Validation completed on 2026-08-14

- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test:ai-cost` passes all 15 tests.
- `npm.cmd run test:product-context` passes all 24 tests.
- `npm.cmd run test:url-inspection` passes all 17 tests.
- `npm.cmd run test:database` passes the sanitizer and historical-operation grouping tests.
- GraphQL schema parsing passes, and the JSONL `operationLogs` fallback was verified to return
  grouped untraced operations.
- Browser automation remained unavailable (`agent.browsers.list()` returned an empty list), so the
  new Operations Logs presentation still needs a manual visual/responsive smoke test.

### Next-session continuation checklist

1. Resolve local PostgreSQL authentication without exposing the password in chat.
2. Prefer creating a dedicated `prism` database role instead of using the `postgres` administrator
   at runtime.
3. Configure `.env`, then run `db:create`, `db:migrate`, and `db:import-cost-ledger`.
4. Verify the 87 pre-existing JSONL cost rows migrated idempotently and remain untraced where
   payloads are absent.
5. Fully restart the backend and generate a new Audience operation.
6. Confirm the new operation is PostgreSQL-backed and the frontend shows captured input/output,
   duration, status, errors/flags, usage, cost, and related IDs.
7. Manually inspect the larger Operations Logs UI at desktop and narrow widths and test
   disclosure/filter keyboard behavior.

## Session update — 2026-08-18

### SQLite operation persistence

- The PostgreSQL operation database is superseded by local SQLite persistence. No PostgreSQL
  service, port, role, password, `DATABASE_URL`, or `POSTGRES_ADMIN_URL` is required at runtime.
- `backend/database/client.mjs` uses Node 22's built-in `node:sqlite` API. The default database file
  is `data/prism.db`; set `DATABASE_PATH` in `.env` only to use another local location.
- `data/prism.db`, `data/prism.db-wal`, and `data/prism.db-shm` are ignored by Git. The canonical
  tables remain `operations`, `operation_attempts`, `operation_payloads`, `operation_costs`, and
  `schema_migrations`.
- The schema migration is SQLite-native: timestamps and JSON values are stored as text; JSON is
  serialized at the database boundary, and exact cost decimals remain text to avoid rounding.
- `npm.cmd run db:create` now creates the local database file and migrates it. `db:migrate` and
  `db:import-cost-ledger` remain available. The JSONL importer was run locally on 2026-08-18 and
  imported 99 historical cost rows; those remain `Untraced` where payloads were never captured.
- Cost ledger and operation-log GraphQL contracts are unchanged. JSONL remains an append-only
  reconciliation fallback if a SQLite read fails.
- `pg` was removed from the direct dependencies. Node 22 currently emits an experimental warning for
  `node:sqlite`; do not replace the persistence layer just to suppress that warning.

### Validation completed on 2026-08-18

- `npm.cmd run db:create` created and migrated `data/prism.db`.
- `npm.cmd run db:import-cost-ledger` imported 99 JSONL records.
- `npm.cmd run test:database` passes all 4 tests, including a new full SQLite operation
  persistence/readback test.
- `npm.cmd run test:ai-cost` passes all 15 tests.
- `npm.cmd run test:product-context` passes all 24 tests.
- `npm.cmd run typecheck` passes.
- `npm.cmd run build` compiled successfully and completed TypeScript validation, but this
  environment timed out while Next was collecting page data after compilation.

## Session update — 2026-08-18 (Material intake and theme follow-up)

### Material intake redesign

- The first Product Workbench stage now renders `components/new-product/material-intake.tsx` from
  `components/new-product/empty-product.tsx`. It preserves the existing URL, file, notes, source
  removal, drag/drop, error, and continuation handlers while replacing the visible Material UI.
- The Material experience is a two-column desktop layout (`2fr / 1fr`) with a responsive stacked
  mobile layout. Its content is: title, URL input, file drop zone, optional collapsed notes,
  included-source list, Continue action, and the four source-quality/privacy hints.
- The five Product Workbench stages now include the exact supporting descriptions in
  `components/new-product/product-workbench.tsx`. On the Material screen, the progress track uses
  the full available workbench width, while the Material content remains constrained to 1200px.
- The hint panel fills the height of the adjacent material column. Its four rows distribute through
  that available height. Hint typography is deliberately large (26px) and icons are 38px, per the
  user’s explicit request.
- The first hint’s Sparkles icon has a restrained animated Prism color/glow treatment. The URL
  submit and Continue actions use animated Prism gradients. Respect `prefers-reduced-motion` by
  disabling those animations.
- The Material-specific CSS is grouped near the top of `app/globals.css`, beginning with
  `.new-product-app-header` and `.new-product-workbench:has(.material-intake)`.

### Header and theme choices

- The app header no longer renders the Prism wordmark on the New Product page, and the header’s
  search button was removed.
- The shared app-header image currently uses `/landing/assets/logo-name.png`. The repository does
  not contain assets literally named `prism-name.png` or `prism-logo.png`; the user referred to
  these by those names. This shared header covers workflow and product pages. Do not alter landing
  assets unless requested.
- The New Product header gives this header image a 52px visual size inside a 56px click target.
- `components/theme-provider.tsx` now exposes a compact circular `ThemeControl`, not the previous
  segmented pill: a Sun indicates light mode and a Moon indicates dark mode. It remains a button
  with `role="switch"`, accessible label/title, and persisted `prism-theme` local storage value.
- Material had previously overridden generic theme variables with fixed dark values; that caused the
  light toggle to appear broken on Product pages. It now defines light Material tokens by default
  and uses a dedicated `html[data-theme="dark"]` override for dark tokens. Header, Material canvas,
  panels, inputs, drop zone, notes textarea, and drag overlay all follow the selected theme.
- Keep shared application chrome on global tokens (`--bg-*`, `--text-*`, `--border-*`). Any new
  feature-specific surface should follow the Material pattern: local light tokens plus an explicit
  dark override, rather than unconditional dark colors.

### Important follow-up and weak points

1. Manually smoke-test the Material page in both themes at desktop and narrow widths. In particular,
   verify the 26px hint rows do not make the side panel feel too dense at intermediate widths and
   that the full-width progress track remains intentional.
2. The current header asset is `logo-name.png`, which may have a wider visual silhouette than a
   conventional square icon. This was an explicit user request; if it appears undersized or cropped,
   confirm whether the desired source is actually a newly supplied `prism-name.png` before changing
   it.
3. `components/new-product/empty-product.tsx` delegates the Material screen to `MaterialIntake`.
   Keep source-processing handlers in `EmptyProduct`; visible Material layout belongs in
   `material-intake.tsx`.
4. The application already contains broad dark-mode compatibility rules for legacy utility classes
   near the end of `app/globals.css`. New components should use the canonical theme variables rather
   than extending those compatibility selectors.
5. Browser automation was unavailable in this environment, so the visual work has TypeScript and
   Product Context test coverage but still needs manual visual verification.

### Validation completed during this follow-up

- `npm.cmd run typecheck` passes after the Material, header, and theme-control changes.
- `npm.cmd run test:product-context` passes all 24 tests after the theme fix.
- A full `npm.cmd run build` earlier in this session completed successfully: compilation,
  TypeScript, static-page generation, and final optimization all passed.

## Session update — 2026-08-28

### Cost-tracking parity

- Anthropic and Perplexity are tracked at the canonical AI-call boundary alongside OpenAI, DeepSeek,
  and Gemini. Each successful provider call produces exactly one attributed ledger row.
- Anthropic normalizes Messages API usage, including cache reads and reported web-search requests.
  Standard text calls are priced from the snapshot. Cache writes without a reported 5-minute versus
  1-hour TTL are intentionally `unpriced`; this avoids guessing a rate.
- Perplexity uses its response `usage.cost.total_cost` as the authoritative charge. When that value
  is absent, Prism reconstructs Sonar, Sonar Pro, and Sonar Reasoning Pro only when token usage and
  reported search-context size are complete. Other missing billable dimensions remain `partial`.
- The Perplexity structured pricing snapshot is canonical under
  `docs/provider-pricing/providers/perplexity.json`; Markdown remains explanatory only.

## Session update — 2026-09-25

### Campaign composer: redesigned, then re-platformed as a modal on explicit direction

- `components/campaign/composer-drawer.tsx` first got a density pass (3-column side-by-side
  Angle/Offer/Persona layout instead of a stacked vertical list, each column scrolling on its own;
  collapsed-by-default option cards with a fixed row height and a hover-revealed expand button that
  never toggles the underlying checkbox — `preventDefault`/`stopPropagation` on the expand click).
- The user then explicitly redirected: the composer is now a **centered modal**, not a side drawer.
  It uses the same portal-to-`document.body` + backdrop pattern as `ConfirmationDialog`
  (`components/confirmation-dialog.tsx`) — `fixed inset-0 z-[150]` backdrop,
  `bg-[#15171A]/80 backdrop-blur-[2px]`, `onMouseDown` with `event.target === event.currentTarget` to
  close on backdrop click, Escape to close, `document.body.style.overflow = "hidden"` while open.
  Sized medium-dominant: `max-w-[760px] max-h-[86vh]`, `rounded-2xl`, with an added soft
  violet-tinted glow in its shadow stack (`rgba(122,76,255,…)`) that echoes the trigger button below.
  Internal header/columns/footer content is unchanged from the density pass.
- **New Prism tier, by explicit user request**: `components/campaign/new-campaign-button.tsx` (the
  single "New campaign" / "New ad set" trigger — the biggest anchor moment in the workflow, since
  everything downstream starts from what gets picked in that composer) now uses a new CSS class,
  `.prism-anchor-action` (`styles/features.css`, right after `.prism-contour`). It reuses the exact
  same technique as `.prism-contour` — a still interior with a slow conic-gradient light traveling
  the border via `--prism-contour-angle` / `prism-action-contour-cycle` (never a filled rainbow fill)
  — just pill-shaped, auto-width, with a touch more ambient glow, and the label gets a gradient-text
  hover treatment copied from `.prism-action-label`. This sits explicitly between `.prism-contour`
  ("moving work between stages") and `.prism-action` (reserved for AI generation). **Do not spread
  `.prism-anchor-action` to other buttons** — it exists for this one trigger only, on direct
  instruction that overrides the general "Prism is concentrated" rule for this specific case.
- Built and iterated as a design exploration first (Claude-native Design-type Artifact, a `.dc.html`
  canvas mockup) before being ported into real code — the mockup used its own hand-authored gradient
  colors; the shipped code instead reuses the app's actual `--prism-blue/violet/pink/amber` tokens
  and existing `.prism-contour` keyframes/custom-property machinery for consistency.
- Hit one build snag worth flagging for the next session: after two sequential `Edit` calls that
  briefly left `composer-drawer.tsx` syntactically unbalanced mid-edit, the webpack dev server (even
  after a full restart and deleting `.next/`) kept serving a stale syntax-error overlay to the
  already-open browser tab; a `curl` to the dev server confirmed it was actually serving HTTP 200
  with the corrected file the whole time. Fix was closing the stuck tab and opening a fresh one —
  the browser tab's error overlay/HMR state was stuck, not the server or the file. If a syntax error
  seems to persist after the file is visibly fixed and the server restarted, suspect the open tab
  before suspecting the build.

### Validation completed this session

- `npm.cmd run typecheck` passes.
- Manually verified in the browser (light and dark mode): trigger button renders as a pill with a
  rotating conic-gradient border and glow (confirmed via computed-style inspection, not just visual);
  clicking it opens the centered modal with a dimmed/blurred backdrop; clicking the backdrop closes
  it; the internal columns/footer still work as before the modal change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
