# PRISM — Context Handoff (Creative Exploration mode audit)

## Where this came from
This project is a marketing/creative-strategy tool. It has two lineage modes selectable via
`LineageModeSwitch`:
- **strategy_lineage** (the original/old mode): Product → Audience → Angle → Creative Type → Execution → Creative
- **creative_exploration** (the new mode, currently the focus): Product → Target Avatars → Angles
  (Creative Direction generation is still a stub — schema/output types exist but nothing invokes it yet)

The immediate goal: make **Target Avatar + Angle combo** work well in creative_exploration mode.
Development had previously been done with Codex, focused mostly on the old mode; this session's
job was to map the current UI wiring and audit whether cost/log persistence correctly covers the
new mode before building further.

## Part 1 — UI flow (verified against code as of last session)

```
AppShell (components/app-shell.tsx)
│
├─ No session → DemoSignIn (components/demo-sign-in.tsx)
│    → signInWithoutPassword() in services/auth.ts
│
└─ Session active → AppHeader (always rendered) + one of:
   │
   ├─ activeTab === "profile" → SettingsShell (components/settings/settings-shell.tsx)
   │    ├─ Profile          → settings/profile-section.tsx        [placeholder, doesn't save]
   │    ├─ AI prompts       → settings/ai-prompts-section.tsx
   │    ├─ Cost ledger      → settings/cost-ledger-section.tsx
   │    └─ Operations logs  → settings/operations-logs-section.tsx
   │
   ├─ no activeProductId → EmptyProduct (components/new-product/empty-product.tsx)
   │    stage="material" → MaterialIntake (new-product/material-intake.tsx)
   │       addFiles()/handleUrl()/handleDescription() build ProductSource[]
   │       "Check sources" → setWorkbenchStage("package")
   │    stage="package"  → package review UI (inline in empty-product.tsx)
   │       "Build product context" → startBuild() → buildRequest set,
   │       productContextFlow="building"
   │    buildRequest set → BuildContext (new-product/build-context.tsx)
   │       flow: building → ready(review) → confirmed
   │       drives ProductWorkbench stage ("build"/"review")
   │    wrapped by ProductWorkbench (new-product/product-workbench.tsx)
   │
   └─ activeProductId set → main area switches on activeTab:
      │
      ├─ "strategy"
      │    ├─ AppHeader shows LineageModeSwitch (components/lineage-mode-switch.tsx)
      │    │     toggles setLineageMode() in store/use-app-store.ts,
      │    │     persisted to sessionStorage "prism-lineage-mode"
      │    ├─ LineageGrammar (components/lineage-grammar.tsx) — floating top toolbar
      │    │     creative_exploration → also renders TargetAvatarTray
      │    │       (components/target-avatar-tray.tsx); "Generate" →
      │    │       generateTargetAvatars() in store →
      │    │       services/strategy.ts generateCreativeExplorationTargetAvatars() →
      │    │       GraphQL mutation → backend/server.mjs:710
      │    │     strategy_lineage → also renders Lineage history disclosure
      │    │       (session-local only, not DB-backed for display)
      │    ├─ StrategyCanvas (components/strategy-canvas.tsx) — React Flow graph
      │    │     node click → selectNode() in store
      │    │     "Generate" on node → store's generate() action
      │    │       (store/use-app-store.ts ~360-406), branches on (mode, node type):
      │    │         creative_exploration + product → generateCreativeExplorationAngles()
      │    │         creative_exploration + anything else → no-op
      │    │         strategy_lineage + product      → generateAudiences()
      │    │         strategy_lineage + audience      → generateAngles()
      │    │         strategy_lineage + angle         → generateCreativeTypes()
      │    │         strategy_lineage + creativeType  → generateExecutions()
      │    │         strategy_lineage + execution     → generateCreatives()
      │    │     GenerationSatellites (components/generation-satellites.tsx) —
      │    │       floating provider/model + Generate button on selected node
      │    └─ LineageInspector (components/lineage-inspector.tsx) — right panel.
      │          Shows if selectedNodeId set AND node belongs to active product AND
      │          activeTab is "strategy"/"creatives" (app-shell.tsx:35-39).
      │          Only Audience has a dedicated content component today
      │          (components/strategy-nodes/audience-node-content.tsx).
      │
      ├─ "creatives"
      │    ├─ CreativesGallery (components/creatives-gallery.tsx) — filterable grid of
      │    │     already-generated "creative" nodes
      │    └─ LineageInspector — same panel/visibility rule as above
      │
      ├─ "experiments" → FuturePlaceholder kind="experiments" [stub]
      └─ "performance" → FuturePlaceholder kind="performance" [stub]
```

### Trigger → handler → file quick reference
| Trigger | Handler | File |
|---|---|---|
| Click product/audience/angle/etc. node | `selectNode()` | `store/use-app-store.ts` |
| Click "Generate" on selected node | `generate()` (mode+type branch) | `store/use-app-store.ts:~360` |
| Click "Generate" in Target Avatar tray | `generateTargetAvatars()` | `store/use-app-store.ts:443` |
| Toggle Strategy Lineage / Creative Exploration | `setLineageMode()` | `components/lineage-mode-switch.tsx` |
| Upload/drop file, incl. .zip | `addFiles()` | `components/new-product/empty-product.tsx` |
| "Check sources" | `processSources()` | `components/new-product/empty-product.tsx` |
| "Build product context" | `startBuild()` | `components/new-product/empty-product.tsx` |
| Inspector panel visibility | `showInspector` boolean | `components/app-shell.tsx:35` |

## Part 2 — Audit: cost/operation-log persistence for Creative Exploration

**Question asked:** does the process/DB schema for expense tracking and input/output prompt logs
persist, and cleanly classify, Creative Exploration mode's operations too — verified, not assumed.

### ✅ Confirmed working
- `backend/ai/workflow-operations.mjs` has 3 dedicated Creative Exploration operation-type
  constants: `creative_exploration_angle_generation`, `creative_exploration_target_avatar_generation`,
  `creative_exploration_direction_generation` (last one defined but never invoked — Creative
  Direction generation is still a stub).
- Operations table (`migrations/001_operation_logs.sql`) has no dedicated "mode" column;
  classification is entirely via the free-text `operation_type` column. This works in practice
  because Creative Exploration's operation types are distinct strings from the old mode's.
- `backend/ai-cost-tracker/index.mjs` treats `operation` as an opaque required string — pricing
  logic never branches on it, so cost tracking is mode-agnostic and works identically for both
  modes (confirmed no special-casing).
- Settings → Cost Ledger and Operations Logs do show Creative Exploration operations as distinct,
  filterable entries.

### ⚠️ Real gaps found (confirmed at schema/code level, not assumptions)
1. **Cosmetic label gap** — `operationLabels` maps in both
   `components/settings/cost-ledger-section.tsx` and `operations-logs-section.tsx` don't include
   the 3 `creative_exploration_*` types. They still display (via `readableIdentifier()` fallback)
   but as raw title-cased strings ("Creative Exploration Angle Generation") instead of a polished
   short label like the old mode gets. Easy fix, not a blocker.
2. **Angle-selection reasoning is not persisted for Creative Exploration angles.**
   `migrations/004_angle_explorations.sql` defines `angle_explorations` with
   `parent_audience_id text not null` + FK to `strategy_nodes` — structurally built only for the
   old mode's audience→angle step. Confirmed by grep: `workspace-data-repository.mjs` only
   inserts/reads that table from the old `generateAngles` path; `generateCreativeExplorationAngles`
   (`backend/server.mjs:669`) never touches it. The AI's exploration object (`selectionSummary`,
   `candidateAngles` — reasoning trail for why angles were picked/rejected) does land in the raw
   operation log payload (`operation_payloads.content_json`), but there is no clean queryable
   equivalent of `angleExploration(audienceId)` for Creative Exploration — so
   `LineageInspector`'s "Strategy" tab today has nothing structured to show for a Creative
   Exploration angle's reasoning.
3. **Target Avatars are never persisted anywhere.** Grepped the entire `migrations/` directory for
   `target_avatar` — zero matches, no table exists. The resolver (`backend/server.mjs:739`) just
   maps the AI's output to fresh IDs and returns it; no `persist*` call at all. They exist only in
   the operation log's raw payload and in frontend memory
   (`store/use-app-store.ts`'s `targetAvatarsByProduct`, no persist middleware). **Reload = gone
   from the UI, even though billed and logged.**

### Bottom line / open decision
Gaps 2 and 3 are the actual blockers for making Target Avatar + Angle combo a first-class
Creative Exploration flow — both are currently write-once/display-once with no reload path, and
neither has first-class DB tables the way Audiences/Angles do in the old mode.

**Proposed next step (not yet started):** design the schema addition —
- a `target_avatars` table, and
- either extend `angle_explorations` to allow `parent_audience_id` nullable/product-scoped, or add
  a parallel `creative_exploration_angle_explorations` table

— before deciding how deep to go on this mode.

## State of the handoff
- The zipped project transfer (`PRISM-transfer.zip`) has just been extracted to
  `D:\Github\PRISM` on the laptop that actually holds the GitHub path (previous session was on a
  different machine that couldn't reach this one).
- New folders exist in the extracted project not mentioned in the audit above and worth checking
  before continuing: `backend/creative-exploration`, `backend/database`, `backend/product-context`,
  `backend/url-inspection` — these may already partially address gaps 2/3, or may be unrelated
  in-flight work. **Verify before assuming either way.**
- Next action queued: continue iterating on Creative Exploration mode, starting with resolving
  whether the schema gaps above are already addressed by those new folders, then implement
  whatever's missing (target_avatars persistence + angle-exploration reasoning persistence for
  Creative Exploration).
