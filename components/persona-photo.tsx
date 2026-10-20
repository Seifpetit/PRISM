"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/api";
import { hashString } from "@/lib/persona-avatar";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { TargetAvatar } from "@/types/strategy";

// A persona's face: a portrait from Pexels, chosen once per persona and remembered in this browser, so the same
// persona wears the same face everywhere it shows. Until a photo is there (no Pexels key on the backend, offline,
// nothing suitable found, still loading) the persona's colour-and-initials mark underneath shows instead.
//
// A search alone can return the wrong person, so every candidate is checked against the persona before it is
// used: its Pexels description must not contradict the persona's gender or age, and must not describe something
// unsuitable for a profile picture (a group, a child, a silhouette, a cigarette). What passes is ranked, and the
// persona's id picks among the best.

type Assignment = { id: string; by: string };

const STORAGE_KEY = "prism-persona-photos:v2";
/** Small marks want a square crop; the drawer wants the whole picture, so `crop: false` keeps its own proportions. */
const photoUrl = (id: string, size: number, crop = true) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&${crop ? `fit=crop&w=${size}&h=${size}` : `w=${size}`}`;

let assignments: Record<string, Assignment> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, Assignment> {
  if (assignments) return assignments;
  assignments = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Partial<Assignment>>;
    for (const [avatarId, value] of Object.entries(saved)) {
      if (value && typeof value.id === "string" && /^\d{1,12}$/.test(value.id)) assignments[avatarId] = { id: value.id, by: typeof value.by === "string" ? value.by.slice(0, 80) : "" };
    }
  } catch {
    // Storage can be blocked or hold something old; faces are simply chosen again.
  }
  return assignments;
}

function remember(avatarId: string, assignment: Assignment) {
  load()[avatarId] = assignment;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // Kept for this session only.
  }
  listeners.forEach((notify) => notify());
}

type Profile = { gender: "woman" | "man" | "person"; age: number | null };

function profileOf(avatar: TargetAvatar): Profile {
  const gender = /\b(female|woman|women|she)\b/i.test(avatar.gender) ? "woman" : /\b(male|man|men|he)\b/i.test(avatar.gender) ? "man" : "person";
  const age = Number(/\d+/.exec(avatar.ageRange)?.[0]);
  return { gender, age: Number.isFinite(age) ? age : null };
}

/** Searches to try, most specific first: the persona's look, then the persona's work. */
function queriesFor(avatar: TargetAvatar): string[] {
  const { gender, age } = profileOf(avatar);
  const band = age === null ? "" : age < 30 ? "young" : age < 45 ? "" : age < 60 ? "middle aged" : "elderly";
  const who = [band, gender].filter(Boolean).join(" ");
  const job = avatar.profession?.trim().split(/[,/(]/)[0].slice(0, 40);
  return [`portrait smiling ${who}`, ...(job ? [`${who} ${job}`] : []), `${who} headshot`];
}

const UNSUITABLE = /\b(smok\w*|cigar\w*|vap(e|ing)|mask(ed)?|hood(ed|ie)?|silhouettes?|child|children|kids?|baby|babies|toddlers?|boys?|girls?|couples?|groups?|family|families|crowd|people|men|women|wedding|shirtless|bikini|tattoos?|dancers?|models?|costume|cosplay|statues?|paintings?|drawings?|illustrations?|faceless|from behind)\b/;
const FEMALE = /\b(woman|female|lady|ladies|mother|mom|she|her)\b/;
const MALE = /\b(man|male|guy|gentleman|father|dad|he|his|bearded|beard)\b/;
const OLD = /\b(elderly|senior|older|old|mature|aged|grey|gray|wrinkl\w*|grandm\w*|grandf\w*|retired)\b/;
const YOUNG = /\b(young|teen\w*|student|youth|twenties)\b/;
const NICE = /\b(smil\w*|friendly|confident|professional|business\w*|office|headshot|portrait|looking at (the )?camera|cheerful|happy|casual)\b/;

type Candidate = { id: string; by: string; alt: string };

/** How well a photo suits the persona: null when its description rules it out, otherwise a score (higher is better). */
function suitability(candidate: Candidate, profile: Profile): number | null {
  const alt = candidate.alt.toLowerCase();
  // A photo with no description can't be checked, so it is never chosen.
  if (!alt.trim()) return null;
  if (UNSUITABLE.test(alt)) return null;
  const female = FEMALE.test(alt);
  const male = MALE.test(alt);
  if (profile.gender === "man" && female && !male) return null;
  if (profile.gender === "woman" && male && !female) return null;
  let score = 0;
  if (profile.gender !== "person" && (profile.gender === "man" ? male : female)) score += 3;
  if (profile.age !== null) {
    if (profile.age >= 55) {
      if (OLD.test(alt)) score += 3;
      else if (YOUNG.test(alt)) return null;
    } else if (profile.age < 35) {
      if (OLD.test(alt)) return null;
      if (YOUNG.test(alt)) score += 1;
    } else if (profile.age < 45 && OLD.test(alt)) return null;
  }
  if (NICE.test(alt)) score += 2;
  return score;
}

const candidates = new Map<string, Promise<Candidate[]>>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60_000;

function candidatesFor(query: string): Promise<Candidate[]> {
  const failed = failedAt.get(query);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return Promise.resolve([]);
  let pending = candidates.get(query);
  if (!pending) {
    pending = api
      .pexelsBanners({ query, page: 1, perPage: 40, orientation: "square" })
      .then((result) => (result.configured ? result.photos.map((photo) => ({ id: photo.id, by: photo.photographer, alt: photo.alt ?? "" })) : []))
      .then((list) => {
        if (!list.length) failedAt.set(query, Date.now());
        return list;
      })
      .catch(() => {
        failedAt.set(query, Date.now());
        return [] as Candidate[];
      });
    candidates.set(query, pending);
    // An empty answer isn't kept, so a later persona (or a key added since) can ask again.
    void pending.then((list) => list.length || candidates.delete(query));
  }
  return pending;
}

const inFlight = new Set<string>();
/** Of the photos that suit a persona, the ones it may choose among: the best few, so different personas differ. */
const SHORTLIST = 8;

async function assign(avatar: TargetAvatar) {
  if (load()[avatar.id] || inFlight.has(avatar.id)) return;
  inFlight.add(avatar.id);
  try {
    const profile = profileOf(avatar);
    for (const query of queriesFor(avatar)) {
      const suitable = (await candidatesFor(query))
        .map((candidate) => ({ candidate, score: suitability(candidate, profile) }))
        .filter((item): item is { candidate: Candidate; score: number } => item.score !== null)
        .sort((a, b) => b.score - a.score);
      if (load()[avatar.id]) return;
      if (!suitable.length) continue;
      const taken = new Set(Object.values(load()).map((item) => item.id));
      const pool = suitable.slice(0, SHORTLIST);
      const start = hashString(avatar.id) % pool.length;
      const pick = Array.from({ length: pool.length }, (_, step) => pool[(start + step) % pool.length]).find((item) => !taken.has(item.candidate.id)) ?? pool[start];
      remember(avatar.id, { id: pick.candidate.id, by: pick.candidate.by });
      return;
    }
    // Nothing suitable came back: the persona keeps its initials rather than a wrong face.
  } finally {
    inFlight.delete(avatar.id);
  }
}

// ---- generated portraits (the first choice) ------------------------------------------------------------------------
// Each persona gets an image made for it when it is generated, and older personas get theirs the first time their
// product's personas are shown. The backend makes them in the background; here they are polled for, fetched once,
// and kept in memory. While one is being made the persona shows its initials; only if it failed (or none can be made)
// does the Pexels search above step in.

type Generated = { status: "pending" | "ready" | "failed" | "none"; full?: string; thumb?: string };
const generated = new Map<string, Generated>();
const requested = new Set<string>();
const productsPolling = new Set<string>();
const POLL_MS = 4_000;
const POLL_LIMIT = 90; // about six minutes

const notifyAll = () => listeners.forEach((notify) => notify());

/** A small copy for the little marks, so a 1024 px picture is not decoded for a 30 px circle. */
function shrink(dataUrl: string, size = 256): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return resolve(dataUrl);
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        context.drawImage(image, (size - image.naturalWidth * scale) / 2, (size - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function fetchReady(avatarId: string) {
  try {
    const full = await api.targetAvatarImage({ avatarId });
    if (!full) return;
    generated.set(avatarId, { status: "ready", full, thumb: await shrink(full) });
    notifyAll();
  } catch {
    // Tried again on the next poll.
  }
}

function applyStatuses(rows: Array<{ avatarId: string; status: string }>) {
  let pending = false;
  for (const row of rows) {
    const status = row.status === "ready" || row.status === "pending" || row.status === "failed" ? row.status : "none";
    const current = generated.get(row.avatarId);
    if (status === "pending") pending = true;
    if (status === "ready") {
      if (!current?.full) void fetchReady(row.avatarId);
      continue;
    }
    if (current?.status !== status) {
      generated.set(row.avatarId, { status });
      notifyAll();
    }
  }
  return pending;
}

/** Asks the backend to make any missing portraits for a product (idempotent), then follows them until they land. */
async function ensureProduct(productId: string) {
  try {
    const pending = applyStatuses(await api.ensureTargetAvatarImages({ productId }));
    if (pending) void poll(productId);
  } catch {
    // No answer from the backend: leave the personas as they are, and let a later render ask again.
    for (const key of [...requested]) if (key.startsWith(productId + ":")) requested.delete(key);
  }
}

async function poll(productId: string) {
  if (productsPolling.has(productId)) return;
  productsPolling.add(productId);
  try {
    for (let round = 0; round < POLL_LIMIT; round += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const pending = applyStatuses(await api.targetAvatarImageStatuses({ productId }));
      if (!pending) return;
    }
  } catch {
    // Polling stops; a later render asks again.
  } finally {
    productsPolling.delete(productId);
  }
}

let ensureTimer: number | null = null;
const ensureQueue = new Set<string>();
/** Batches the personas seen in one render pass into a single request per product. */
function requestPortrait(productId: string, avatarId: string) {
  const key = productId + ":" + avatarId;
  if (requested.has(key)) return;
  requested.add(key);
  ensureQueue.add(productId);
  if (ensureTimer === null) {
    ensureTimer = window.setTimeout(() => {
      ensureTimer = null;
      const products = [...ensureQueue];
      ensureQueue.clear();
      products.forEach((id) => void ensureProduct(id));
    }, 150);
  }
}

// ---- the hook --------------------------------------------------------------------------------------------------

/** The persona and the product it belongs to. Two selectors, each returning a value that stays the same until it truly changes. */
function usePersonaAvatar(avatarId: string) {
  const avatar = useAppStore((state) => {
    for (const list of Object.values(state.targetAvatarsByProduct)) {
      const found = list.find((item) => item.id === avatarId);
      if (found) return found;
    }
    return undefined;
  });
  const productId = useAppStore((state) => Object.entries(state.targetAvatarsByProduct).find(([, list]) => list.some((item) => item.id === avatarId))?.[0]);
  return avatar && productId ? { avatar, productId } : undefined;
}

/** A persona's picture: `src` at a size that suits `size`, and the words to credit it with. Null until there is one
 * (still being made, nothing available), so the initials underneath stay the fallback. */
export function usePersonaPhotoSource(avatarId: string, size: number, crop = true): { src: string; credit: string } | null {
  const found = usePersonaAvatar(avatarId);
  const [, refresh] = useState(0);
  // Read storage only after mounting, so the server-rendered markup and the first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const notify = () => refresh((count) => count + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  const avatar = found?.avatar;
  const productId = found?.productId;
  useEffect(() => {
    if (avatar && productId) requestPortrait(productId, avatar.id);
  }, [avatar, productId]);

  const portrait = generated.get(avatarId);
  // Stock photos only step in once a generated portrait is known to have failed (or cannot be made).
  const needsFallback = portrait?.status === "failed" || portrait?.status === "none";
  useEffect(() => {
    if (avatar && needsFallback) void assign(avatar);
  }, [avatar, needsFallback]);

  if (!mounted) return null;
  if (portrait?.status === "ready" && portrait.full) return { src: size <= 320 && portrait.thumb ? portrait.thumb : portrait.full, credit: "AI-generated portrait" };
  const chosen = needsFallback ? load()[avatarId] : undefined;
  return chosen ? { src: photoUrl(chosen.id, size, crop), credit: chosen.by ? "Photo by " + chosen.by + " on Pexels" : "Photo from Pexels" } : null;
}

/** The persona's portrait as a picture that fills its mark. Render it as a child of the mark's element (which
 * clips it round); it draws nothing until a picture is there, so the initials underneath stay the fallback. */
export function PersonaPhoto({ avatarId, size = 96 }: { avatarId: string; size?: number }) {
  const photo = usePersonaPhotoSource(avatarId, size);
  const [broken, setBroken] = useState<string | null>(null);
  if (!photo || broken === photo.src) return null;
  return h("img", {
    className: "persona-photo",
    src: photo.src,
    alt: "",
    "aria-hidden": true,
    draggable: false,
    title: photo.credit,
    onError: () => setBroken(photo.src),
  });
}
