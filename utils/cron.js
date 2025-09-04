const cron = require('node-cron');
const db = require('../db_config/db.js'); 

function scheduleAdminExpiryCheck() {

    cron.schedule('0 0 * * *', async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const [result] = await db.execute(
                `UPDATE users 
       SET status = ${false} 
       WHERE access_expires_on IS NOT NULL 
         AND access_expires_on < ? 
         AND status = ${true}`,
                [today]
            );

            console.log(`[CRON] ${result.affectedRows} admin(s) disabled due to expiry on ${today}`);
        } catch (error) {
            console.error('[CRON ERROR]', error);
        }
    });
}
module.exports = scheduleAdminExpiryCheck;