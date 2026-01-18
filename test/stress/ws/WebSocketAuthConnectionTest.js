import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, PATHS, DEFAULT_HEADERS } from "../../config/config.js";
import { buildCreateNoteRequest } from "../../data/note.js";

const WS_URL = "ws://localhost:8080/ws/websocket";

export const options = {
    scenarios: {
        stress_full_flow: {
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
        ws_connecting: ["p(95)<800"],
        checks: ["rate>0.99"],
    },
};

function uniqueEmail() {
    return `k6_full_vu${__VU}_iter${__ITER}_${Date.now()}@test.local`;
}

function extractToken(loginRes) {
    const contentType = loginRes.headers["Content-Type"] || "";
    let token;

    if (contentType.includes("application/json")) {
        const body = loginRes.json();
        token = body.token || body.accessToken || body.access_token;
    } else {
        token = loginRes.body;
    }

    if (typeof token === "string") token = token.replace(/^"|"$/g, "").trim();
    return token;
}

export default function () {
    const email = uniqueEmail();
    const password = "1234";

    // 1) Register
    const regRes = http.post(`${BASE_URL}${PATHS.REGISTER}`, JSON.stringify({ email, password }), {
        headers: DEFAULT_HEADERS,
        tags: { endpoint: "register" },
    });

    if (!check(regRes, { "register status is 200/201": (r) => r.status === 200 || r.status === 201 })) {
        return;
    }

    // 2) Login
    const loginRes = http.post(`${BASE_URL}${PATHS.AUTHENTICATE}`, JSON.stringify({ email, password }), {
        headers: DEFAULT_HEADERS,
        tags: { endpoint: "auth" },
    });

    if (!check(loginRes, { "login status is 200": (r) => r.status === 200 })) return;

    const token = extractToken(loginRes);
    if (!token || token.length < 10) return;

    // 3) WS connect + STOMP + create note once connected
    const wsRes = ws.connect(WS_URL, { tags: { endpoint: "ws-stomp" } }, function (socket) {
        socket.on("open", function () {
            socket.send(
                `CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\nAuthorization:Bearer ${token}\n\n\u0000`
            );
        });

        socket.on("message", function (data) {
            if (data.includes("CONNECTED")) {
                // Subscribe (same as your script)
                socket.send(`SUBSCRIBE\nid:sub-0\ndestination:/topic/notes\n\n\u0000`);
                socket.send(`SUBSCRIBE\nid:sub-1\ndestination:/topic/notes/editing\n\n\u0000`);
                socket.send(`SUBSCRIBE\nid:sub-2\ndestination:/user/queue/notes\n\n\u0000`);
                socket.send(`SUBSCRIBE\nid:sub-3\ndestination:/user/queue/notes/editing\n\n\u0000`);

                const payload = buildCreateNoteRequest();
                // Create a note (HTTP) once per connection
                // NOTE: Adjust PATHS.NOTES (or payload fields) to match your API.
                const createRes = http.post(
                    `${BASE_URL}${PATHS.CREATE_NOTE}`,
                    JSON.stringify(payload),
                    {
                        headers: {
                            ...DEFAULT_HEADERS,
                            Authorization: `Bearer ${token}`,
                        },
                        tags: { endpoint: "notes-create" },
                    }
                );

                console.log(createRes.body, createRes.status, createRes.headers, createRes.json())
                check(createRes, {
                    "note create status is 200/201": (r) => r.status === 200 || r.status === 201,
                });

                // Periodically send editing status updates (same as your script)
                socket.setInterval(function () {
                    const payload = JSON.stringify({ noteId: 1, isEditing: true });
                    socket.send(`SEND\ndestination:/app/notes/editing\ncontent-type:application/json\n\n${payload}\u0000`);
                }, 5000);
            }
            else
            {
                console.log(data)
            }

            // Heartbeats
            if (data === "\n") {
                socket.send("\n");
            }
        });

        socket.on("close", function () {
            // console.log(`VU ${__VU} disconnected`);
        });

        socket.on("error", function (e) {
            // console.error(`VU ${__VU} error: ${e.error()}`);
        });

        sleep(25);
        socket.close();
    });

    check(wsRes, { "websocket connected": (r) => r && r.status === 101 });

    sleep(0.1);
}
