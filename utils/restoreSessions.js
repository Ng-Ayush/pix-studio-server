const fs = require("fs");
const path = require("path");
const { createClient } = require("../whatsappClientManager.js");

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

// ✅ Clean chrome lock files before restoring
function cleanChromeLocks(sessionId) {
    const ignoreFolder = path.join(SESSIONS_DIR, `_IGNORE_${sessionId}`);
      const lockFiles = [
        "SingletonLock",
        "SingletonCookie", 
        "SingletonSocket",
        "lockfile",          // ← this is your culprit
        "DevToolsActivePort" // ← also clean this
    ];

    lockFiles.forEach((file) => {
        const lockPath = path.join(ignoreFolder, file);
        if (fs.existsSync(lockPath)) {
            fs.rmSync(lockPath, { force: true });
            console.log(`🧹 Removed lock file: ${file}`);
        }
    });
}

async function restoreSessions(waClients, io) {
    if (!fs.existsSync(SESSIONS_DIR)) return;

    const entries = fs.readdirSync(SESSIONS_DIR);

    for (const entry of entries) {
        if (!entry.startsWith("user_") || !entry.endsWith(".data.json")) continue;

        const sessionId = entry.replace(".data.json", "");
        const userId = sessionId.replace("user_", "");

        const ignoreFolderPath = path.join(SESSIONS_DIR, `_IGNORE_${sessionId}`);
        if (!fs.existsSync(ignoreFolderPath)) {
            console.log(`⚠️ Skipping ${sessionId} — _IGNORE_ folder missing`);
            continue;
        }

        // ✅ Clean lock files before restore attempt
        cleanChromeLocks(sessionId);

        console.log(`🔁 Restoring session: ${sessionId} for userId: ${userId}`);

        try {
            const client = await createClient(sessionId, userId, io);
            waClients.set(+userId, client);
            console.log(`✅ Restored client for userId: ${userId}`);
        } catch (error) {
            console.error(`❌ Failed to restore session for userId ${userId}:`, error);
        }
    }
}

module.exports = restoreSessions;