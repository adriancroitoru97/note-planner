import { NOTE_PRIVACY_VALUES } from  "../config/config.js"
import { pick } from "../config/common.js"

/**
 * notes.js
 * Centralizes note creation helpers
 */

/**
 * Builds a CreateNoteRequest DTO:
 *   {
 *     title: string,
 *     text: string,
 *     privacy: NotePrivacy,
 *     sharedWithUserIds?: Set<Long> (sent as JSON array)
 *   }
 *
 * Rule:
 * - sharedWithUserIds should be included only when privacy === "PRIVATE"
 *
 * @param {Object} [opts]
 * @param {string[]} [opts.sharedWithUserIds] - must be valid user IDs in your DB
 * @returns {{title:string, text:string, privacy:string, sharedWithUserIds?:number[]}}
 */
export function buildCreateNoteRequest(opts = {}) {
    const privacy = pick(NOTE_PRIVACY_VALUES);

    const dto = {
        title: `k6_note_${__VU}_${__ITER}_${Date.now()}`,
        text: "Created by k6",
        privacy,
    };

    // Only relevant if privacy = PRIVATE
    if (privacy === "PRIVATE") {
        dto.sharedWithUserIds = [1, 2];
    }

    // Optional override (if you want deterministic behavior)
    if (Array.isArray(opts.sharedWithUserIds)) {
        dto.sharedWithUserIds = opts.sharedWithUserIds.map((x) => Number(x));
    }

    return dto;
}
