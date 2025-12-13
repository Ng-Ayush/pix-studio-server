const pool = require('../db_config/db.js');
const { initWhatsAppClientForAdmin, clients } = require('../whatsappClientManager.js');
const qrMap = new Map();

exports.getUsersByCurrentId = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute(
            `SELECT 
  u.*, 
  mf.status AS whatsapp_status
FROM 
  users u
LEFT JOIN 
  whatsapp_sessions mf 
ON 
  u.id = mf.user_id
WHERE 
  u.id = ?;`, [id]);

        if (!users.length) {
            return res.status(404).send({ message: 'users not found' });
        }

        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get users', err });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        console.log(req.body);

        let { studio_name, email, phone_number, address, terms_and_condition, studio_icon, youtube_url, instagram_url, facebook_url } = req.body;
        const id = req.body.id;
        await pool.execute(
            'UPDATE users SET studio_name = ?, email = ?,phone_number = ?, address = ?, terms_and_condition = ?, studio_icon = ?,youtube_url = ? , instagram_url = ?, facebook_url = ?  WHERE id = ?',
            [studio_name, email, phone_number, address, terms_and_condition, studio_icon, youtube_url, instagram_url, facebook_url, id]
        );

        res.send({ message: 'Profile updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update profile', err: err });
    }
};

exports.connectToWhatsApp = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id || req.params.userId;  // assuming JWT-authenticated user
        const io = req.app.locals.io;
        if (!io) return res.status(500).send('Socket.io not initialized');

        if (clients.has(userId)) {
            const client = clients.get(userId);
            if (client.isReady) {
                io.to(`user_${userId}`).emit('ready');
            }
            const qr = qrMap.get(userId);
            return res.status(200).json({
                message: 'WhatsApp client already initialized',
                status: 200,
                qr: qr || null
            });
        }

        const client = await initWhatsAppClientForAdmin(userId);

        client.on('qr', qr => {
            qrMap.set(userId, qr);
            io.to(`user_${userId}`).emit('qr', qr);
        });

        client.on('authenticated', async () => {
            const waNumber = client.info?.wid?.user || null;

            console.log("WHATS NUMNBER >..", client.info);

            await pool.query(`
        INSERT INTO whatsapp_sessions (user_id, wa_number, status, last_connected)
        VALUES (?, ?, 'ready', NOW())
        ON DUPLICATE KEY UPDATE wa_number=VALUES(wa_number), status='ready', last_connected=NOW(), updated_at=NOW()
      `, [userId, waNumber]);
            io.to(`user_${userId}`).emit('authenticated');
        });

        client.on('ready', async () => {
            client.isReady = true;
            await pool.query(`
      UPDATE whatsapp_sessions SET status='ready', last_connected=NOW(), updated_at=NOW()
      WHERE user_id=?
    `, [userId]);
            io.to(`user_${userId}`).emit('ready');
        });

        client.on('disconnected', async reason => {
            await safeDestroyWhatsAppClient(userId);
            await pool.query(`DELETE FROM whatsapp_sessions WHERE user_id=?`, [userId]);
            io.to(`user_${userId}`).emit('disconnected', reason);
        });

        await client.initialize();
        clients.set(userId, client);

        res.status(200).json({ message: 'WhatsApp client initializing', status: 200 });
    } catch (err) {
        console.error('WhatsApp init error:', err);
        res.status(500).json({ error: 'Failed to initialize WhatsApp client' });
    }
}

async function safeDestroyWhatsAppClient(userId) {
    if (clients.has(userId)) {
        const client = clients.get(userId);
        try {
            // Wait for client to fully destroy its session
            await client.destroy();
            clients.delete(userId);
        } catch (e) {
            console.error('Failed to cleanly destroy WhatsApp client:', e);
        }
    }
}


exports.disconnectWhatsApp = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id || req.params.userId;  // assuming JWT-authenticated user
        const io = req.app.locals.io;
        if (!io) return res.status(500).send('Socket.io not initialized');  // Add this line
        await safeDestroyWhatsAppClient(userId);
        await pool.query(`DELETE FROM whatsapp_sessions WHERE user_id = ?`, [userId]);
        io.to(`user_${userId}`).emit('disconnected', 'User manually disconnected');
        res.status(200).json({ message: 'WhatsApp client disconnected', status: 200 });
    } catch (err) {
        console.error('Error in disconnectWhatsApp:', err);
        res.status(500).json({ error: 'Failed to disconnect WhatsApp client' });
    }
};

exports.resetDeleteAiPhotoCount = async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).send({
                status: 400,
                message: "user_id is required"
            });
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
              AND e.is_ai_upload = 1`,  // Ensure we only count photos from AI-uploaded events
            [user_id]  // Bind the userId to the query
        );

        const activeAiPhotos = total_weighted_count || 0;

        await pool.execute(
            `
            UPDATE users
            SET used_photo_count = ?
            WHERE id = ?
            `,
            [activeAiPhotos, user_id]
        );

        return res.send({
            status: 200,
            message: "AI photo usage count reset successfully",
            data: {
                user_id,
                used_photo_count: activeAiPhotos
            }
        });


    } // Get the user ID from the request
    catch (error) {
        return res.send({
            status: 500,
            message: "Failed to reset AI photo usage count",
            error: error.message
        });
    }
};