import http from "k6/http";
import { check, sleep } from "k6";

import { EXISTING_USER, BASE_URL, PATHS, DEFAULT_HEADERS } from "../config/config.js";

/*
===============================================================================
k6 TEST OPTIONS – EXPLANATION
===============================================================================

scenarios.ramping-vus:
- Ramps the number of concurrent Virtual Users (VUs) over time.
- Each VU behaves like an independent client repeatedly executing default().

thresholds:
- Define pass/fail performance criteria (error rate and latency percentiles).

Adjustments:
- Increase target VUs -> more concurrency.
- Reduce sleep() -> higher request rate.
- Increase duration/stages -> longer sustained load.

===============================================================================
*/
export const options = {
    scenarios: {
        stress_login: {
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
        http_req_duration: ["p(95)<500"],
    },
};

/**
 * Executes a login request against the authentication endpoint.
 *
 * Purpose:
 * - Stress test authentication throughput/latency.
 * - Validate that credentials are accepted and responses remain stable under load.
 */
export default function () {
    const res = http.post(
        `${BASE_URL}${PATHS.AUTHENTICATE}`,
        JSON.stringify(EXISTING_USER),
        {
            headers: DEFAULT_HEADERS,
            tags: { endpoint: "login" },
        }
    );

    check(res, {
        "login status is 200": (r) => r.status === 200,
        "login returned a body": (r) => r.body && r.body.length > 0,
    });

    sleep(0.1);
}
