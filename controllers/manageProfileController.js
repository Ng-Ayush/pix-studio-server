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
            await pool.query(`UPDATE whatsapp_sessions SET status='disconnected', updated_at=NOW() WHERE user_id=?`, [userId]);
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