const { Client, LocalAuth } = require('whatsapp-web.js');
const clients = new Map();

function initWhatsAppClientForAdmin(adminId) {
    if (clients.has(adminId)) return clients.get(adminId);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: adminId.toString() }),
        puppeteer: { headless: false }
    });

    clients.set(adminId, client);
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