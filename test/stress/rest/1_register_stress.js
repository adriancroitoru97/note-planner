import http from "k6/http";
import { check, sleep } from "k6";

import { BASE_URL, PATHS, DEFAULT_HEADERS } from "../../config/config.js";
import { buildRegisterUser } from "../../data/user.js";

/*
===============================================================================
k6 TEST OPTIONS – EXPLANATION
===============================================================================

Registration is stateful:
- It creates database rows.
- Use unique emails per request to avoid 409/duplicate failures.

thresholds:
- Writes typically have higher latency than reads; tune p(95) accordingly.

===============================================================================
*/
export const options = {
    scenarios: {
        stress_register: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "30s", target: 10 },
                { duration: "1m", target: 50 },
                { duration: "1m", target: 100 },
            ],
            gracefulRampDown: "10s",
        },
    },
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<800"],
    },
};

/**
 * Registers a unique user per iteration.
 *
 * Purpose:
 * - Stress test user onboarding performance.
 * - Validate DB insert + validation + hashing under concurrent load.
 *
 * Note:
 * - This will grow your DB quickly. Use a disposable dev DB or reset between runs.
 */
export default function () {
    const payload = buildRegisterUser();

    const res = http.post(
        `${BASE_URL}${PATHS.REGISTER}`,
        JSON.stringify(payload),
        {
            headers: DEFAULT_HEADERS,
            tags: { endpoint: "register" },
        }
    );

    check(res, {
        "register status is 200/201": (r) => r.status === 200 || r.status === 201,
    });

    sleep(0.1);
}
