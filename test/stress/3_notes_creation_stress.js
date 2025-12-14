import http from "k6/http";
import { check, sleep } from "k6";

import { EXISTING_USER, BASE_URL, PATHS, DEFAULT_HEADERS } from "../config/config.js";
import { buildCreateNoteRequest } from "../data/note.js";

/*
===============================================================================
k6 TEST OPTIONS – EXPLANATION
===============================================================================

This test authenticates once per VU and then creates notes repeatedly.
- This avoids overloading the auth endpoint when your goal is write throughput.

thresholds:
- Create-note is a write path; expect higher latency vs GET requests.

===============================================================================
*/
export const options = {
    scenarios: {
        create_notes: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "30s", target: 10 },
                // { duration: "1m", target: 50 },
                // { duration: "1m", target: 100 },
            ],
            gracefulRampDown: "10s",
        },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<800"],
    },
};

// Per-VU token cache (login once per VU)
const vuState = {};

/**
 * Authenticates the current VU and caches the token for reuse.
 *
 * Purpose:
 * - Reduce authentication noise and better isolate create-note performance.
 *
 * @returns {string} JWT token string
 */
function getToken() {
    vuState[__VU] ??= {};
    if (vuState[__VU].token) return vuState[__VU].token;

    const res = http.post(
        `${BASE_URL}${PATHS.AUTHENTICATE}`,
        JSON.stringify(EXISTING_USER),
        {
            headers: DEFAULT_HEADERS,
            tags: { endpoint: "login" },
        }
    );

    check(res, { "login status is 200": (r) => r.status === 200 });

    // Adjust field name if your backend uses a different property.
    const token = res.json("token") || res.json("accessToken") || res.json("jwt");

    check(token, {
        "received JWT": (t) => typeof t === "string" && t.length > 10,
    });

    vuState[__VU].token = token;
    return token;
}

/**
 * Creates a note using the CreateNoteRequest DTO:
 *   { title, text, privacy, sharedWithUserIds? }
 *
 * Purpose:
 * - Stress test write throughput and DB persistence.
 * - Validate enum + conditional DTO logic under load.
 */
export default function () {
    const token = getToken();
    const payload = buildCreateNoteRequest();

    const res = http.post(
        `${BASE_URL}${PATHS.CREATE_NOTE}`,
        JSON.stringify(payload),
        {
            headers: {
                ...DEFAULT_HEADERS,
                Authorization: `Bearer ${token}`,
            },
            tags: { endpoint: "create_note" },
        }
    );

    check(res, {
        "create note status is 200/201": (r) => r.status === 200 || r.status === 201,
    });

    sleep(1);
}
