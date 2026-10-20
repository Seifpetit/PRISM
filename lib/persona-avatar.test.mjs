import assert from "node:assert/strict";
import test from "node:test";
import { personaInitials, personaMarkColors } from "./persona-avatar.ts";

test("personaMarkColors is deterministic for the same id", () => {
  const a = personaMarkColors("avatar-123");
  const b = personaMarkColors("avatar-123");
  assert.deepEqual(a, b);
});

test("personaMarkColors differs across distinct ids (no collision in a small sample)", () => {
  const ids = ["avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5"];
  const hues = new Set(ids.map((id) => personaMarkColors(id).background));
  assert.ok(hues.size > 1, "expected more than one distinct colour across 5 different ids");
});

test("personaMarkColors always returns white foreground text", () => {
  assert.equal(personaMarkColors("any-id").foreground, "#ffffff");
});

test("personaInitials skips leading stop words", () => {
  assert.equal(personaInitials("The apartment household tracking a summer cooling bill"), "AH");
});

test("personaInitials handles a two-word label", () => {
  assert.equal(personaInitials("Growing Family"), "GF");
});

test("personaInitials falls back to the first two letters of a one-word label", () => {
  assert.equal(personaInitials("Homeowner"), "HO");
});

test("personaInitials handles an all-stop-word label without crashing", () => {
  assert.equal(personaInitials("The a of"), "TA");
});

test("personaInitials handles an empty label", () => {
  assert.equal(personaInitials(""), "?");
});
