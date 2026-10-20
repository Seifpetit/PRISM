import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";

/** Freeform dev feedback, intentionally unscoped — not tied to any workspace or user. */
export function createUserNote(note) {
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) throw new Error("Note cannot be empty.");
  if (trimmed.length > 4_000) throw new Error("Note must be 4,000 characters or fewer.");
  const row = { id: randomUUID(), note: trimmed, createdAt: new Date().toISOString() };
  getDatabasePool().query(
    `insert into user_notes (id, note, created_at) values ($1, $2, $3)`,
    [row.id, row.note, row.createdAt],
  );
  return row;
}

export function listUserNotes(limit = 200) {
  return getDatabasePool()
    .query(`select id, note, created_at from user_notes order by created_at desc limit $1`, [limit])
    .rows.map((row) => ({ id: row.id, note: row.note, createdAt: row.created_at }));
}
