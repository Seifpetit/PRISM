// An ad set holds three ingredient slots: persona, angle, offer. A slot can be empty. The database columns are NOT
// NULL and unique per combination, so an empty slot holds a placeholder id that points at nothing
// ("~<ad set id>:<slot>", see createEmptyCampaignConcept in the backend). A removed ingredient also points at
// nothing, and both read the same way: the slot is open and can be linked to an ingredient.

export type SlotAxis = "avatar" | "angle" | "offer";

/** What an ad set's port shows for a slot that was never linked (as opposed to one whose ingredient was removed). */
export const EMPTY_SLOT_LABEL = "Not linked yet";

/** True for a slot that was left empty on purpose (a new ad set, or a link that was cut). */
export const isEmptySlotId = (id: string | null | undefined): boolean => !id || id.startsWith("~");
