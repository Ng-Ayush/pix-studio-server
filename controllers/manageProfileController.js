const pool = require('../db_config/db.js');
// const { create, ev } = require("@open-wa/wa-automate");
const fs = require('fs');
const path = require('path');
const waClients = require('../server.js');
const { createClient,killPending, isPending } = require('../whatsappClientManager.js');
const SESSIONS_DIR = path.join(process.cwd(), "sessions");

// -------------------- GET USER --------------------
exports.getUsersByCurrentId = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute(
            `SELECT u.*, mf.status AS whatsapp_status
       FROM users u
       LEFT JOIN whatsapp_sessions mf ON u.id = mf.user_id
       WHERE u.id = ?`,
            [id]
        );

        if (!users.length) {
            return res.status(404).send({ message: 'User not found' });
        }

        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get user', err });
    }
};

// -------------------- UPDATE PROFILE --------------------
exports.updateProfile = async (req, res) => {
    try {
        const {
            studio_name,
            email,
            phone_number,
            address,
            terms_and_condition,
            studio_icon,
            youtube_url,
            instagram_url,
            facebook_url,
            id
        } = req.body;

        await pool.execute(
            `UPDATE users 
       SET studio_name=?, email=?, phone_number=?, address=?, 
           terms_and_condition=?, studio_icon=?, youtube_url=?, 
           instagram_url=?, facebook_url=? 
       WHERE id=?`,
            [
                studio_name,
                email,
                phone_number,
                address,
                terms_and_condition,
                studio_icon,
                youtube_url,
                instagram_url,
                facebook_url,
                id
            ]
        );

        res.send({ message: 'Profile updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update profile', err });
    }
};

exports.connectToWhatsApp = async (req, res) => {
    const io = req.app.locals.io;

    const userId = req.user?.id || req.params.userId;
    const sessionId = `user_${userId}`;

    // ✅ Already connected
    if (waClients.has(userId)) {
        return res.send({
            status: true,
            message: "Already connected"
        });
    }

    if (isPending(sessionId)) {
        console.log(`♻️ QR already pending for ${sessionId}, re-emitting...`);
        // Just tell frontend to wait, QR will re-emit via the listener
        return res.send({ status: 200, message: "QR already in progress, check socket" });
    }

    res.send({
        status: 200,
        message: "Initializing WhatsApp..."
    });

    try {
        const client = await createClient(sessionId, userId, io);

        waClients.set(userId, client);

        // ✅ DB UPDATE
        await pool.query(
            `INSERT INTO whatsapp_sessions (user_id, status, last_connected)
             VALUES (?, 'ready', NOW())
             ON DUPLICATE KEY UPDATE 
             status='ready', 
             last_connected=NOW()`,
            [userId]
        );

    } catch (err) {
        console.error("❌ WA init error:", err);
        killPending(sessionId);
        const sessionPath = path.join(process.cwd(), 'session',`_IGNORE_${sessionId}`);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log("🗑️ Deleted session folder after failure:", sessionPath);
        }
        io.to(`user_${userId}`).emit(
            "wa:error",
            "Failed to init WhatsApp"
        );
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.disconnectWhatsApp = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = `user_${userId}`;
        const client = waClients.get(userId);

        // if (!client) {
        //     return res.send({ status: 400, message: "No active session" });
        // }

        if(client){
            await client.logout();
        }

        // 🔒 Logout WhatsApp

        // 🧹 Remove from memory
        cleanChromeLocks();
        await sleep(1000); 

        

        // 🗃️ Remove from DB
        // await SessionModel.deleteOne({ userId });

        // 🗑️ Force delete session folder (Linux)
        const sessionPath = path.join(process.cwd(),'sessions', `_IGNORE_${sessionId}`);
        const userJsonPath = path.join(process.cwd(),'sessions', `${sessionId}.data.json`);

        if (fs.existsSync(userJsonPath)) {
            await deleteFileWithRetry(userJsonPath);
            console.log("🗑️ Deleted user json:", userJsonPath);
        }

        if (fs.existsSync(sessionPath)) {
            await deleteFileWithRetry(sessionPath);
            console.log("🗑️ Deleted session folder:", sessionPath);
        } else {
            console.log("ℹ️ Session folder not found:", sessionPath);
        }

        waClients.delete(userId);


        return res.send({
            status: 200,
            message: "WhatsApp disconnected successfully"
        });

    } catch (err) {
        console.error("❌ Disconnect error:", err);
        return res.send({ status: 500, error: err.message });
    }
};

const deleteFileWithRetry = async (filePath, retries = 5, delay = 2000) => {
    let attempts = 0;
    while (attempts < retries) {
        try {
            await fs.rm(filePath);
            console.log(`🗑️ Successfully deleted file: ${filePath}`);
            return; // Successfully deleted
        } catch (err) {
            if (err.code === 'EBUSY' && attempts < retries - 1) {
                console.log(`⚠️ File is busy, retrying... (${attempts + 1}/${retries})`);
                attempts++;
                await sleep(delay); // Wait before retrying
            } else {
                console.error(`❌ Error deleting file: ${err.message}`);
                throw err; // Rethrow the error after retries
            }
        }
    }
};


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



// -------------------- RESET AI PHOTO COUNT --------------------
exports.resetDeleteAiPhotoCount = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).send({ status: 400, message: 'user_id is required' });
        }

        const [[{ total_weighted_count }]] = await pool.execute(
            `SELECT COALESCE(SUM(
          CASE e.photo_quality
            WHEN 'high' THEN 10
            WHEN 'standard' THEN 3
            ELSE 1
          END
        ), 0) AS total_weighted_count
       FROM photos p
       JOIN folders f ON p.folder_id = f.id
       JOIN events e ON f.event_id = e.id
       WHERE e.created_by = ?
         AND e.is_ai_upload = 1`,
            [user_id]
        );

        const activeAiPhotos = total_weighted_count || 0;

        await pool.execute(
            `UPDATE users SET used_photo_count=? WHERE id=?`,
            [activeAiPhotos, user_id]
        );

        return res.send({
            status: 200,
            message: 'AI photo usage count reset successfully',
            data: { user_id, used_photo_count: activeAiPhotos }
        });

    } catch (error) {
        return res.send({
            status: 500,
            message: 'Failed to reset AI photo usage count',
            error: error.message
        });
    }
};
