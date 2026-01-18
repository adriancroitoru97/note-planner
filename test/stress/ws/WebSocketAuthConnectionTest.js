import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, WS_URL, PATHS, DEFAULT_HEADERS } from "../../config/config.js";

export const options = {
    scenarios: {
        stress_ws_notes: {
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
        ws_connecting: ["p(95)<800"],
        checks: ["rate>0.99"],
        // ws_msgs_sent: ["count>0"],
        // ws_msgs_received: ["count>0"],
    },
};

function uniqueEmail() {
    return `k6_vu${__VU}_iter${__ITER}_${Date.now()}@test.local`;
}

function extractToken(loginRes) {
    const contentType = loginRes.headers['Content-Type'] || '';
    let token;

    if (contentType.includes('application/json')) {
        try {
            const body = loginRes.json();
            token = body.token || body.accessToken || body.access_token || body;
        } catch (e) {
            token = loginRes.body;
        }
    } else {
        token = loginRes.body;
    }

    if (typeof token === 'string') token = token.replace(/^"|"$/g, '').trim();
    return token;
}

export default function () {
    const userPayload = {
        email: uniqueEmail(),
        password: '1234',
    };

    // 0. Register user (same user used for login)
    const registerRes = http.post(
        `${BASE_URL}${PATHS.REGISTER}`,
        JSON.stringify(userPayload),
        {
            headers: DEFAULT_HEADERS, // assumes it includes Content-Type: application/json
            tags: { endpoint: "register" },
        }
    );

    const registerOk = check(registerRes, {
        "registered status is 200/201": (r) => r.status === 200 || r.status === 201,
    });

    if (!registerOk) {
        console.error(`VU ${__VU} - Register failed with status ${registerRes.status}: ${registerRes.body}`);
        return;
    }

    // 1. Authenticate to get a token (same email/password as registered)
    const loginRes = http.post(
        `${BASE_URL}${PATHS.AUTHENTICATE}`,
        JSON.stringify({
            email: userPayload.email,
            password: userPayload.password,
        }),
        {
            headers: { 'Content-Type': 'application/json' },
            tags: { endpoint: "auth" },
        }
    );

    if (!check(loginRes, { 'logged in successfully': (r) => r.status === 200 })) {
        console.error(`VU ${__VU} - Login failed with status ${loginRes.status}: ${loginRes.body}`);
        return;
    }

    const token = extractToken(loginRes);

    if (!token || token.length < 10) {
        console.error(`VU ${__VU} - Could not extract a valid token. Body was: ${loginRes.body}`);
        return;
    }

    // 3. Connect to WebSocket (UNCHANGED)
    const url = WS_URL;
    const params = { tags: { my_tag: 'hello' } };

    const res = ws.connect(url, params, function (socket) {
        socket.on('open', function () {
            // Send STOMP CONNECT frame
            socket.send(`CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\nAuthorization:Bearer ${token}\n\n\u0000`);
        });

        socket.on('message', function (data) {
            if (data.includes('CONNECTED')) {
                // Subscribe to topics
                socket.send(`SUBSCRIBE\nid:sub-0\ndestination:/topic/notes\n\n\u0000`);
                socket.send(`SUBSCRIBE\nid:sub-1\ndestination:/topic/notes/editing\n\n\u0000`);
                socket.send(`SUBSCRIBE\nid:sub-2\ndestination:/user/queue/notes\n\n\u0000`);

                // Periodically send editing status updates
                socket.setInterval(function () {
                    const payload = JSON.stringify({
                        noteId: 1,
                        isEditing: true,
                    });
                    socket.send(`SEND\ndestination:/app/notes/editing\ncontent-type:application/json\n\n${payload}\u0000`);
                }, 5000); // Send every 5 seconds
            }

            // Handle Heartbeats (Server sends \n)
            if (data === '\n') {
                socket.send('\n');
            }
        });

        socket.on('close', function () {
            console.log(`VU ${__VU} disconnected`);
        });

        socket.on('error', function (e) {
            console.error(`VU ${__VU} error: ${e.error()}`);
        });

        // Keep the connection open for a while
        sleep(25);
        socket.close();
    });

    check(res, { 'websocket connected': (r) => r && r.status === 101 });
}
