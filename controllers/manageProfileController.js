const pool = require('../db_config/db.js');
const { create, ev } = require("@open-wa/wa-automate");
const fs = require('fs');
const path = require('path');
const waClients = require('../server.js');

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

// -------------------- CONNECT WHATSAPP --------------------
// exports.connectToWhatsApp = async (req, res) => {
//     try {
//         const userId = req.user?._id || req.user?.id || req.params.userId;
//         const io = req.app.locals.io;

//         if (!io) return res.status(500).json({ message: 'Socket.io not initialized' });
//         if (!userId) return res.status(400).json({ message: 'User id missing' });

//         // ✅ Already connected or initializing
//         if (clients.has(userId)) {
//             const existing = getClient(userId);
//             const qr = qrMap.get(userId) || null;

//             if (existing?.isReady) {
//                 io.to(`user_${userId}`).emit('ready');
//             }

//             return res.status(200).json({
//                 status: 200,
//                 message: 'WhatsApp already connected',
//                 qr
//             });
//         }

//         if (initializing.has(userId)) {
//             return res.status(200).json({
//                 status: 200,
//                 message: 'WhatsApp is initializing, please wait...'
//             });
//         }

//         initializing.add(userId);

//         console.log(`🚀 Initializing WhatsApp for user ${userId}`);

//         const client = await initWhatsAppClientForAdmin(userId);
//         client.isReady = false;

//         // 🛑 Bind events only once
//         if (!client.__eventsBound) {
//             client.__eventsBound = true;

//             client.on('qr', qr => {
//                 console.log(`📲 QR for user ${userId}`);
//                 qrMap.set(userId, qr);
//                 io.to(`user_${userId}`).emit('qr', qr);
//             });

//             client.on('authenticated', () => {
//                 console.log(`🔐 Authenticated user ${userId}`);
//                 io.to(`user_${userId}`).emit('authenticated');
//             });

//             client.on('ready', async () => {
//                 if (client.isReady) return; // prevent duplicate logs
//                 client.isReady = true;
//                 qrMap.delete(userId);
//                 initializing.delete(userId);

//                 console.log(`✅ WhatsApp ready for user ${userId}`);
//                 io.to(`user_${userId}`).emit('ready');

//                 try {
//                     await pool.query(
//                         `INSERT INTO whatsapp_sessions (user_id, status, last_connected)
//              VALUES (?, 'ready', NOW())
//              ON DUPLICATE KEY UPDATE status='ready', last_connected=NOW()`,
//                         [userId]
//                     );
//                 } catch (e) {
//                     console.warn('DB update failed:', e.message);
//                 }
//             });

//             client.on('disconnected', async (reason) => {
//                 console.warn(`⚠️ WhatsApp disconnected for ${userId}: ${reason}`);

//                 client.isReady = false;
//                 io.to(`user_${userId}`).emit('wa_disconnected', reason);

//                 // ❗ Do NOT auto-destroy here.
//                 // Let whatsapp-web.js try internal reconnect.
//                 // Destroy only on auth_failure or manual logout.
//             });

//             client.on('auth_failure', async () => {
//                 console.error(`❌ Auth failure for ${userId}. Need fresh QR.`);
//                 initializing.delete(userId);

//                 await destroyWhatsAppClient(userId);
//                 qrMap.delete(userId);

//                 io.to(`user_${userId}`).emit('auth_failure');

//                 try {
//                     await pool.query(
//                         `UPDATE whatsapp_sessions SET status='auth_failed' WHERE user_id=?`,
//                         [userId]
//                     );
//                 } catch { }
//             });
//         }

//         await client.initialize();
//         setClient(userId, client);

//         return res.status(200).json({
//             status: 200,
//             message: 'WhatsApp client initializing'
//         });

//     } catch (err) {
//         console.error('❌ WhatsApp init error:', err);
//         initializing.delete(req.user?.id);
//         return res.status(500).json({
//             status: 500,
//             message: 'Failed to initialize WhatsApp client'
//         });
//     }
// };

exports.connectToWhatsApp = async (req, res) => {
    const io = req.app.locals.io;
    const userId = req.user?.id || req.params.userId;
    const sessionId = `user_${userId}`;

    if (waClients.has(userId)) {
        return res.send({ status: true, message: "Already connected" });
    }

    res.send({ status: 200, message: "WhatsApp connection started", waClients: waClients });

    // Listen to ALL QR events and filter by session
    ev.on("qr.**", (qr, eventSessionId) => {
        if (eventSessionId === sessionId) {
            console.log("🚀 QR event for session:", eventSessionId);
            io.to(`user_${userId}`).emit("wa:qr", qr);
        }
    });

    try {
        const client = await create({
            sessionId,
            multiDevice: true,
            headless: true,
            qrTimeout: 0
        });

        waClients.set(userId, client);
        console.log("🚀🚀🚀🚀🚀🚀🚀🚀 PUTER READY :");
        try {
            await pool.query(
                `INSERT INTO whatsapp_sessions (user_id, status, last_connected)
             VALUES (?, 'ready', NOW())
             ON DUPLICATE KEY UPDATE status='ready', last_connected=NOW()`,
                [userId]
            );
        } catch (e) {
            console.warn('DB update failed:', e.message);
        }
        io.to(`user_${userId}`).emit("wa:connected");

    } catch (err) {
        console.error("❌ WA init error:", err);
        io.to(`user_${userId}`).emit("wa:error", "Failed to init WhatsApp");
    }
};

// -------------------- DISCONNECT WHATSAPP (MANUAL) --------------------
exports.disconnectWhatsApp = async (req, res) => {
    try {
        const userId = req.user.id || req.params.userId;
        const io = req.app.locals.io;

        if (!userId) {
            return res.send({ message: 'User id missing', status: 400 });
        }

        console.log(`🚪 Logical WhatsApp disconnect for ${userId}`);

        // ✅ Just remove from memory (no destroy, no logout)
        if (waClients.has(userId)) {
            const client = waClients.get(userId);
            client.isReady = false;
            waClients.delete(userId);
        }

        // ✅ Delete DB entry only
        await pool.query(
            `DELETE FROM whatsapp_sessions WHERE user_id = ?`,
            [userId]
        );

        io.to(`user_${userId}`).emit('wa_disconnected', 'User manually disconnected');

        return res.send({
            status: 200,
            message: 'WhatsApp disconnected successfully'
        });

    } catch (err) {
        console.error('disconnectWhatsApp error:', err);
        return res.send({
            message: 'Failed to disconnect WhatsApp',
            status: 500,
        });
    }
};

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
