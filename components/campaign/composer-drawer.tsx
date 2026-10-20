"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Lightbulb, Loader2, Sparkles, Tag, UserRound, X, type LucideIcon } from "lucide-react";
import { h } from "@/lib/h";
import {
  AXES_IN_ORDER,
  AXIS_LABEL,
  expandFreePick,
  MAX_COMBOS_PER_ACTION,
  resolveFreePick,
  TEST_TYPE_INFO,
  testDrift,
  type Axis,
  type ComposePick,
  type ConceptKey,
  type TestType,
} from "@/lib/campaign-rules";
import { useAppStore } from "@/store/use-app-store";
import { CAMPAIGN_KINDS, CAMPAIGN_KIND_LABEL, type CampaignKind } from "@/types/campaign";
import type { StrategyNode, TargetAvatar } from "@/types/strategy";

type Item = { id: string; title: string; detail: string };

const NO_AVATARS: TargetAvatar[] = [];
const testTypes = Object.keys(TEST_TYPE_INFO) as TestType[];
const pickOf = (pick: ComposePick, axis: Axis) =>
  axis === "avatar" ? pick.avatarIds : axis === "angle" ? pick.angleIds : pick.offerIds;
const plural = (axis: Axis) => `${AXIS_LABEL[axis]}s`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
const joinList = (list: string[]) => (list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

/** The sections run in testing order: an angle is tested first, then an offer, then a persona. */
const TESTING_ORDER: Axis[] = ["angle", "offer", "avatar"];

/** Each ingredient's own identity — the same role colours it wears everywhere else (the canvas, the ad set
    drawer's Persona/Angle/Offer rows): angle blue, offer amber, persona violet. Brand colour here marks identity
    and selection, never a generation moment — the one exception is the "Generate…" buttons themselves, which are
    real AI actions and carry the Prism gradient instead. */
const AXIS_ROLE: Record<Axis, { Icon: LucideIcon; accent: string; band: string; on: string }> = {
  angle: { Icon: Lightbulb, accent: "var(--type-angle)", band: "var(--type-angle-band)", on: "var(--type-angle-on)" },
  offer: { Icon: Tag, accent: "var(--type-offer)", band: "var(--type-offer-band)", on: "var(--type-offer-on)" },
  avatar: { Icon: UserRound, accent: "var(--type-persona)", band: "var(--type-persona-band)", on: "var(--type-persona-on)" },
};

const axisId = (concept: ConceptKey, axis: Axis) => (axis === "avatar" ? concept.avatarId : axis === "angle" ? concept.angleId : concept.offerId);

const nodeItem = (node: StrategyNode): Item => ({
  id: node.id,
  title: node.label,
  detail: "framing" in node ? (node.framing ?? "") : "",
});

const avatarItem = (avatar: TargetAvatar): Item => ({
  id: avatar.id,
  title: avatar.label,
  detail: [avatar.profession, avatar.ageRange ? `age ${avatar.ageRange}` : ""].filter(Boolean).join(" · "),
});

/** A small row of mutually exclusive choices. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return h(
    "div",
    { role: "group", "aria-label": label, className: "grid grid-cols-3 gap-1 rounded-xl border border-[#E7E9EC] bg-[#F6F7F9] p-1" },
    ...options.map((option) =>
      h(
        "button",
        {
          key: option.value,
          type: "button",
          "aria-pressed": option.value === value,
          onClick: () => onChange(option.value),
          className: `rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            option.value === value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`,
        },
        option.label,
      ),
    ),
  );
}

/** One choice: a radio for a fixed ingredient, a checkbox for the one being compared. Its role's own colour
    tints the mark and, once checked, the row itself — so an angle pick glows blue, an offer amber, a persona
    violet, and the three sections stay visually distinct without needing a legend. Collapsed by default at a
    fixed height (one line, title only) so a column reads as a dense list; hovering reveals a small expand
    button that opens the card to its full detail, so scanning stays compact and detail is one click away. */
function Option({
  axis,
  type,
  name,
  checked,
  item,
  tag,
  onChange,
}: {
  axis: Axis;
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  item: Item;
  tag?: string;
  onChange: () => void;
}) {
  const role = AXIS_ROLE[axis];
  const [expanded, setExpanded] = useState(false);
  const canExpand = Boolean(item.detail);

  return h(
    "label",
    {
      className: `group relative flex cursor-pointer gap-1.5 rounded-md border py-1.5 pl-2 pr-5 transition-colors ${
        expanded ? "items-start" : "h-[27px] items-center overflow-hidden"
      } ${checked ? "" : "border-[#E7E9EC] bg-[#FAFBFC] hover:bg-[#F6F7F9]"}`,
      style: checked
        ? { borderColor: role.accent, background: `color-mix(in srgb, ${role.accent} 7%, var(--bg-panel))` }
        : undefined,
    },
    h("span", {
      className: `grid h-4 w-4 shrink-0 place-items-center rounded transition-colors ${expanded ? "mt-0.5" : ""}`,
      style: checked ? { background: role.band, color: role.on } : { background: "var(--bg-elevated)", color: "var(--muted)", border: "1px solid var(--border-default)" },
      "aria-hidden": true,
    }, checked ? h(Check, { size: 9, strokeWidth: 3 }) : h(role.Icon, { size: 9, strokeWidth: 2 })),
    h("input", { type, name, checked, onChange, className: "sr-only" }),
    h(
      "span",
      { className: "min-w-0 flex-1" },
      h(
        "span",
        { className: "flex min-w-0 items-baseline gap-1" },
        h("span", { className: `text-[11px] font-semibold leading-[14px] text-ink ${expanded ? "" : "min-w-0 truncate"}` }, item.title),
        tag
          ? h("span", { className: "shrink-0 whitespace-nowrap rounded-full border border-[#DDE0E4] px-1 py-px text-[7px] font-semibold uppercase tracking-[.06em] text-muted" }, tag)
          : null,
      ),
      expanded && item.detail ? h("span", { className: "mt-1 block text-[10px] leading-[13px] text-muted" }, item.detail) : null,
    ),
    canExpand
      ? h(
          "button",
          {
            type: "button",
            "aria-label": expanded ? "Show less" : "Show more",
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
              // Prevent the label's default click-through to the checkbox, so expanding never toggles the pick.
              event.preventDefault();
              event.stopPropagation();
              setExpanded((current) => !current);
            },
            className: `absolute right-1 top-1 grid h-4 w-4 shrink-0 place-items-center rounded text-muted transition-opacity hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lineage ${
              expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`,
          },
          h(ChevronDown, { size: 11, className: `transition-transform ${expanded ? "rotate-180" : ""}`, "aria-hidden": true }),
        )
      : null,
  );
}

/** Shown in place of a list when the product has none of that ingredient yet. Generating one is a real AI
    action, so — unlike the rest of this drawer, which stays in role colour or neutral ink — this button alone
    carries the Prism gradient. */
function EmptyAxis({ axis, pending, onGenerate, text }: { axis: Axis; pending: boolean; onGenerate: () => void; text?: string }) {
  return h(
    "div",
    { className: "rounded-lg border border-dashed border-[#DDE0E4] px-2 py-2.5 text-[10px] text-muted" },
    pending
      ? h("span", { className: "flex items-center gap-1.5" }, h(Loader2, { size: 11, className: "animate-spin" }), `Generating ${plural(axis)}…`)
      : h(
          "div",
          { className: "flex flex-col items-start gap-1.5" },
          h("span", null, text ?? `No ${plural(axis)} yet.`),
          h(
            "button",
            {
              type: "button",
              onClick: onGenerate,
              className: "prism-icon-action flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-1",
            },
            h(Sparkles, { size: 11 }),
            `Generate ${plural(axis)}`,
          ),
        ),
  );
}

/**
 * Composes a campaign in one place: what varies, the fixed ingredients, the varying ones. Nothing is created
 * until Create, and then the campaign and all its ad sets are created together. (Single ad sets are added from
 * the canvas instead: "New ad set" drops an empty one that ingredients are then linked to.)
 */
export function ComposerDrawer() {
  const openKind = useAppStore((state) => state.composerKind);
  const productId = useAppStore((state) => state.activeProductId);
  const avatars = useAppStore((state) => (state.activeProductId ? (state.targetAvatarsByProduct[state.activeProductId] ?? NO_AVATARS) : NO_AVATARS));
  const nodes = useAppStore((state) => state.nodes);
  const busy = useAppStore((state) => state.campaignBusy);
  const serverError = useAppStore((state) => state.campaignError);
  const avatarPending = useAppStore((state) => state.targetAvatarGenerationPending);
  const anglePending = useAppStore((state) => state.generatingParentId !== null);
  const offerPending = useAppStore((state) => state.offerGenerationPending);
  const closeComposer = useAppStore((state) => state.closeComposer);
  const createCampaignFromComposer = useAppStore((state) => state.createCampaignFromComposer);
  const generateTargetAvatars = useAppStore((state) => state.generateTargetAvatars);
  const generateAngles = useAppStore((state) => state.generateFromSelected);
  const generateOffers = useAppStore((state) => state.generateOffers);

  // The composer opens on a test campaign; the type can be changed here.
  const [kind, setKind] = useState<CampaignKind>(openKind ?? "test");
  const [pickedTestType, setTestType] = useState<TestType>("angle");
  const testType = pickedTestType;
  const varies = TEST_TYPE_INFO[testType].varies;
  // What the user has ticked, per axis. An axis they have not touched keeps its defaults.
  const [ticks, setTicks] = useState<Partial<Record<Axis, string[]>>>({});

  // Modal semantics: the page behind it stays put and Escape closes it, same as ConfirmationDialog.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeComposer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeComposer]);

  const allItems: Record<Axis, Item[]> = useMemo(
    () => ({
      avatar: avatars.map(avatarItem),
      angle: nodes.filter((node) => node.productId === productId && node.type === "angle").map(nodeItem),
      offer: nodes.filter((node) => node.productId === productId && node.type === "offer").map(nodeItem),
    }),
    [avatars, nodes, productId],
  );
  const available = useMemo(
    () => ({ avatar: allItems.avatar.map((i) => i.id), angle: allItems.angle.map((i) => i.id), offer: allItems.offer.map((i) => i.id) }),
    [allItems],
  );
  // Anything can be ticked, in any combination. The testing order (angle, then offer, then persona) shapes the
  // defaults and the guidance, and never blocks.
  const pick = useMemo(() => resolveFreePick(available, testType, ticks), [available, testType, ticks]);
  const { combos, skipped, error } = useMemo(() => expandFreePick(pick), [pick]);
  const drift = useMemo(() => testDrift(pick, testType), [pick, testType]);

  if (!openKind) return null;
  const missing = AXES_IN_ORDER.filter((axis) => allItems[axis].length === 0);

  const setTicked = (axis: Axis, ids: string[]) => setTicks((current) => ({ ...current, [axis]: available[axis].filter((id) => ids.includes(id)) }));
  const toggle = (axis: Axis, id: string) => {
    const ticked = pickOf(pick, axis);
    setTicked(axis, ticked.includes(id) ? ticked.filter((existing) => existing !== id) : [...ticked, id]);
  };
  const generators: Record<Axis, { run: () => void; pending: boolean }> = {
    avatar: { run: () => void generateTargetAvatars(), pending: avatarPending },
    angle: { run: () => void generateAngles(productId ?? undefined), pending: anglePending },
    offer: { run: () => void generateOffers(), pending: offerPending },
  };

  const count = `${combos.length} ad set${combos.length === 1 ? "" : "s"}`;
  const status = missing.length
    ? `Add ${joinList(missing.map((axis) => withArticle(AXIS_LABEL[axis])))} first.`
    : (error ?? `${count} will be created${skipped ? `, ${skipped} already in this campaign` : ""}`);
  // Three steps, one per ingredient. An ad set can be added only once all three are chosen.
  const chosen = TESTING_ORDER.filter((axis) => pickOf(pick, axis).length > 0);
  const canCreate = !busy && !missing.length && !error && combos.length > 0 && chosen.length === TESTING_ORDER.length;
  // Guidance, not a gate: it says whether the ad sets stay a clean comparison of what the campaign tests.
  const guidance =
    !missing.length && !error && combos.length > 0
      ? drift.length === 0
        ? { ok: true, text: `Clean test: only the ${AXIS_LABEL[varies]} changes.` }
        : {
            ok: false,
            text: `This also changes the ${joinList(TESTING_ORDER.filter((axis) => drift.includes(axis)).map((axis) => AXIS_LABEL[axis]))}, so it stops being a clean ${AXIS_LABEL[varies]} test. You can still add it. The usual order is angle, then offer, then persona.`,
          }
      : null;
  // A connected stepper, one node per ingredient, each in its own role colour once chosen — angle blue, offer
  // amber, persona violet, the same identity the ingredient wears everywhere else in the app.
  const progress = h(
    "div",
    {
      role: "progressbar",
      "aria-label": "Ingredients chosen",
      "aria-valuemin": 0,
      "aria-valuemax": TESTING_ORDER.length,
      "aria-valuenow": chosen.length,
      "aria-valuetext": `${chosen.length} of ${TESTING_ORDER.length} chosen`,
      className: "flex items-start",
    },
    ...TESTING_ORDER.flatMap((axis, index) => {
      const done = chosen.includes(axis);
      const role = AXIS_ROLE[axis];
      const node = h(
        "div",
        { key: axis, className: "flex flex-col items-center gap-1.5" },
        h(
          "span",
          {
            className: "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors",
            style: done ? { background: role.accent, color: "#fff" } : { background: "var(--bg-elevated)", color: "var(--muted)", border: "1.5px solid var(--border-default)" },
          },
          done ? h(Check, { size: 11, strokeWidth: 3 }) : String(index + 1),
        ),
        h("span", { className: "mono whitespace-nowrap text-[8px] font-semibold uppercase tracking-[.1em]", style: { color: done ? role.accent : "var(--text-muted)" } }, AXIS_LABEL[axis]),
      );
      const connector = index < TESTING_ORDER.length - 1
        ? h("span", { key: `${axis}-line`, className: "mt-3 h-[1.5px] flex-1 rounded-full transition-colors", style: { background: done ? role.accent : "var(--border-default)" } })
        : null;
      return connector ? [node, connector] : [node];
    }),
  );

  /** One ingredient, as a column: header pinned, list scrolling within its own column. All three columns sit
      side by side and share the same height, so every ingredient is visible at once — scrolling moves through
      one ingredient's own options, never past it to reach the next. Every item can be ticked; the campaign's
      tested axis is marked, nothing is locked. */
  const checkSection = (axis: Axis) => {
    const ticked = pickOf(pick, axis);
    const list = allItems[axis];
    const role = AXIS_ROLE[axis];
    return h(
      "fieldset",
      { key: axis, className: "flex min-h-0 min-w-0 flex-col rounded-lg border border-[#E7E9EC] bg-[#FAFBFC] p-1.5" },
      h(
        "legend",
        { className: "mb-1.5 flex w-full flex-col gap-1 px-0.5" },
        h(
          "span",
          { className: "flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5" },
          h("span", { className: "truncate text-[11px] font-semibold text-ink" }, capitalize(plural(axis))),
          axis === varies
            ? h("span", { className: "mono rounded-full px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[.08em]", style: { color: role.on, background: role.band } }, "Comparing")
            : null,
        ),
        list.length
          ? h(
              "span",
              { className: "flex flex-wrap items-baseline justify-between gap-x-1.5 gap-y-0.5 text-[10px]" },
              h("span", { className: "text-muted" }, `${ticked.length}/${list.length}`),
              h(
                "span",
                { className: "flex items-baseline gap-1.5" },
                h("button", { type: "button", onClick: () => setTicked(axis, available[axis]), className: "font-semibold hover:underline", style: { color: role.accent } }, "All"),
                h("button", { type: "button", onClick: () => setTicked(axis, []), className: "font-semibold hover:underline", style: { color: role.accent } }, "None"),
              ),
            )
          : null,
      ),
      list.length
        ? h(
            "div",
            { className: "min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5" },
            ...list.map((item) =>
              h(Option, {
                key: item.id,
                axis,
                type: "checkbox",
                name: `composer-${axis}`,
                checked: ticked.includes(item.id),
                item,
                onChange: () => toggle(axis, item.id),
              }),
            ),
          )
        : h("div", { className: "min-h-0 flex-1 overflow-y-auto" }, h(EmptyAxis, { axis, pending: generators[axis].pending, onGenerate: generators[axis].run })),
    );
  };

  // A medium-dominant modal, not a side drawer: this is the single biggest anchor moment in the workflow
  // (everything downstream — ad sets, eventual generation — starts from what gets picked here), so it interrupts
  // on purpose rather than sharing the screen with the canvas. Same portal-to-body + backdrop pattern as
  // ConfirmationDialog, sized up for real content instead of a confirmation.
  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] flex items-center justify-center bg-[#15171A]/80 p-4 backdrop-blur-[2px]",
        role: "presentation",
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) closeComposer();
        },
      },
      h(
        "div",
        {
          role: "dialog",
          "aria-modal": true,
          "aria-label": "Campaign composer",
          className:
            "relative flex w-full max-w-[760px] max-h-[86vh] flex-col overflow-hidden rounded-2xl border border-[#DFE2E6] bg-white " +
            "shadow-[0_30px_80px_rgba(21,23,26,.35),0_0_0_1px_rgba(122,76,255,.12),0_0_60px_-14px_rgba(122,76,255,.3)]",
        },
    // Pinned above the ingredient columns: what this drawer is for, and how far along the three-step pick is.
    h(
      "div",
      { className: "relative shrink-0 border-b border-[#E7E9EC] bg-[#FAFBFC]" },
      h(
        "button",
        { type: "button", onClick: closeComposer, "aria-label": "Close composer", className: "absolute right-3 top-3 rounded p-1 text-muted hover:bg-canvas hover:text-ink" },
        h(X, { size: 16 }),
      ),
      h(
        "div",
        { className: "px-4 pr-9 pt-3" },
        h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "New campaign"),
        h("h1", { className: "mt-0.5 truncate text-base font-bold leading-5 text-ink" }, "Compare what matters"),
        h(
          "p",
          { className: "mt-1 text-xs leading-4 text-muted" },
          "Choose what to compare. Nothing is created until you press Create.",
        ),
      ),
      h("div", { className: "px-4 pb-3 pt-3" }, progress),
    ),
    h(
      "div",
      { className: "flex min-h-0 flex-1 flex-col gap-3 p-4" },
      ...[
            h(
              "div",
              { key: "kind-test", className: "shrink-0 space-y-3" },
              h(
                "section",
                { "aria-label": "Campaign type" },
                h("p", { className: "mb-2 text-xs font-semibold text-ink" }, "Campaign type"),
                h(Segmented, {
                  label: "Campaign type",
                  value: kind,
                  options: CAMPAIGN_KINDS.map((value) => ({ value, label: CAMPAIGN_KIND_LABEL[value] })),
                  onChange: (value: string) => setKind(value as CampaignKind),
                }),
              ),
              h(
                "section",
                { "aria-label": "What to test" },
                h("p", { className: "mb-2 text-xs font-semibold text-ink" }, "What do you want to test?"),
                h(Segmented, {
                  label: "What varies",
                  value: testType,
                  options: testTypes.map((value) => ({ value, label: TEST_TYPE_INFO[value].label })),
                  onChange: (value: string) => {
                    setTestType(value as TestType);
                    setTicks({});
                  },
                }),
                h("p", { className: "mt-1.5 text-[11px] leading-4 text-muted" }, TEST_TYPE_INFO[testType].hint),
              ),
            ),
          ],
      // The three ingredients side by side, same height, each scrolling on its own — so every ingredient is
      // visible at once and scrolling only ever moves through one ingredient's own options.
      h("div", { key: "columns", className: "grid min-h-0 flex-1 grid-cols-3 gap-2" }, ...TESTING_ORDER.map(checkSection)),
    ),
    // Pinned below the ingredient columns: where things stand, and the one action that matters.
    h(
      "div",
      { className: "shrink-0 space-y-2 border-t border-[#E7E9EC] bg-white p-4" },
      h(
        "p",
        {
          role: "status",
          className: `text-xs font-semibold ${missing.length || error ? "" : "text-ink"}`,
          style: missing.length || error ? { color: "var(--status-warning)" } : undefined,
        },
        status,
      ),
      guidance
        ? h(
            "p",
            { className: "text-[11px] leading-4", style: { color: guidance.ok ? "var(--status-success)" : "var(--status-warning)" } },
            guidance.text,
          )
        : null,
      !missing.length && !error && combos.length === 1
        ? h("p", { className: "text-[11px] leading-4 text-muted" }, `A test compares at least two, so tick another ${AXIS_LABEL[varies]} if you can.`)
        : null,
      serverError ? h("p", { role: "alert", className: "text-[11px]", style: { color: "var(--status-error)" } }, serverError) : null,
      h(
        "div",
        { className: "flex items-center justify-end gap-2" },
        h(
          "button",
          {
            type: "button",
            onClick: closeComposer,
            className: "h-9 rounded-md px-3 text-xs font-semibold text-muted hover:bg-[#F6F7F9] hover:text-ink",
          },
          "Cancel",
        ),
        h(
          "button",
          {
            type: "button",
            disabled: !canCreate,
            onClick: () => void createCampaignFromComposer({ kind, testType, combos }),
            className: "h-9 rounded-md bg-ink px-4 text-xs font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-35",
          },
          busy ? "Creating…" : "Create campaign",
        ),
      ),
    ),
      ),
    ),
    document.body,
  );
}
