import { FIRSTNAMES, LASTNAMES } from "../config/config.js"
import { pick } from "../config/common.js"

/**
 * users.js
 * Centralizes user credentials and user generation helpers.
 * Randomizes firstname and lastname for realistic registration tests.
 */


/**
 * Generates a unique email address to prevent collisions during register tests.
 *
 * @returns {string} Unique email
 */
export function makeUniqueEmail() {
    return `k6_${__VU}_${__ITER}_${Date.now()}@test.local`;
}

/**
 * Builds a register DTO matching your backend request:
 *   {
 *     firstname,
 *     lastname,
 *     email,
 *     password
 *   }
 *
 * - firstname / lastname are randomized
 * - email is unique per request
 *
 * @returns {{firstname:string, lastname:string, email:string, password:string}}
 */
export function buildRegisterUser() {
    return {
        firstname: pick(FIRSTNAMES),
        lastname: pick(LASTNAMES),
        email: makeUniqueEmail(),
        password: "Test123!", // must satisfy backend password rules
    };
}
