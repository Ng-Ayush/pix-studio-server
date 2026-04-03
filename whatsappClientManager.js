const { create, ev } = require("@open-wa/wa-automate");
const path = require("path");

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

const emittedQrSessions = new Set();
let qrListenerAttached = false;

const pendingClients = new Map();

function attachQrListener(io) {
    if (qrListenerAttached) return;

    ev.on("qr.**", (qr, sessionId) => {
        if (emittedQrSessions.has(sessionId)) return;

        emittedQrSessions.add(sessionId);

        const userId = sessionId.replace("user_", "");
        console.log("📲 QR for:", sessionId);

        io.to(`user_${userId}`).emit("wa:qr", qr);
    });

    qrListenerAttached = true;
}

async function createClient(sessionId, userId, io) {
    attachQrListener(io); // ✅ ONLY PLACE QR IS ATTACHED

    if (pendingClients.has(sessionId)) {
        console.log(`⏳ Session ${sessionId} already in progress, reusing...`);
        return pendingClients.get(sessionId);
    }

    emittedQrSessions.delete(sessionId);

    const clientPromise = create({
        sessionId,
        multiDevice: true,
        headless: true,
        useChrome: true,
        sessionDataPath: SESSIONS_DIR,
        qrTimeout: 60,
        authTimeout: 60,
        eventMode: true,
        disableSpins: true,
        skipUpdateCheck: true,
        killProcessOnBrowserClose: true,
    }).then((client) => {
        console.log("✅ Client ready:", sessionId);
        pendingClients.delete(sessionId); // ✅ No longer pending
        io.to(`user_${userId}`).emit("wa:connected");
        return client;
    }).catch((err) => {
        pendingClients.delete(sessionId); // ✅ Clean up on failure too
        throw err;
    });

    // ✅ Store the promise immediately so parallel calls reuse it
    pendingClients.set(sessionId, clientPromise);

    return clientPromise;
}

function killPending(sessionId) {
    pendingClients.delete(sessionId);
    emittedQrSessions.delete(sessionId);
}

function isPending(sessionId) {
    return pendingClients.has(sessionId);
}

module.exports = { createClient,killPending, isPending };