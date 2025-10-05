const { Client, LocalAuth } = require('whatsapp-web.js');
const clients = new Map();

async function initWhatsAppClientForAdmin(adminId) {
    if (clients.has(adminId)) return clients.get(adminId);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: adminId.toString() }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }  // or false for debugging
    });

    clients.set(adminId, client);
    console.log("CLIENT HERE ", clients);

    return client;
}

async function destroyWhatsAppClient(adminId) {
    if (clients.has(adminId)) {
        const client = clients.get(adminId);
        await client.destroy();
        clients.delete(adminId);
    }
}

module.exports = { initWhatsAppClientForAdmin, destroyWhatsAppClient, clients };
