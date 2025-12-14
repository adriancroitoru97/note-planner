/**
 * constants.js
 * Centralized configuration for base URL and API paths.
 */

/** Base url for endpoint paths */
export const BASE_URL = "http://localhost:8080";

/** Endpoint paths */
export const PATHS = {
    AUTHENTICATE: "/api/v1/auth/authenticate",
    REGISTER: "/api/v1/auth/register",

    // Notes
    GET_ALL_VISIBLE_NOTES: "/api/v1/notes/getAllVisibleNotes",

    // Change if your controller mapping differs
    CREATE_NOTE: "/api/v1/notes/createNote",
};

/** Default HTTP headers used across tests */
export const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
};

/**
 * A real, existing account used for login/authenticated actions.
 * Ensure this user exists in the DB before running tests.
 */
export const EXISTING_USER = {
    email: "test@123.com",
    password: "1234",
};

/** Values for note's privacy values */
export const NOTE_PRIVACY_VALUES = ["PUBLIC", "PRIVATE"];

/**
 * First names for account creation
 * @type {string[]}
 */
export const FIRSTNAMES = [
    "Alex",
    "Mihai",
    "Andrei",
    "Ioana",
    "Maria",
    "Elena",
    "Daniel",
    "Vlad",
    "Ana",
    "Paul",
];

/**
 * Last names for account creation
 * @type {string[]}
 */
export const LASTNAMES = [
    "Popescu",
    "Ionescu",
    "Georgescu",
    "Dumitrescu",
    "Stan",
    "Marin",
    "Radu",
    "Matei",
    "Petrescu",
    "Ilie",
];
