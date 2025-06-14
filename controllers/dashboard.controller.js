const pool = require('../db_config/db.js'); // Assuming this is your MySQL connection pool

exports.getDashboardStats = async (req, res) => {
    try {
        // Get the total number of customers for the logged-in user
        const [totalCustomers] = await pool.execute(
            'SELECT COUNT(*) as count FROM customers WHERE created_by = ?',
            [req.user.id]
        );

        // Get the total number of files uploaded
        const [totalFiles] = await pool.execute(
            'SELECT COUNT(*) as count FROM files f JOIN customers c ON f.customer_id = c.id WHERE c.created_by = ?',
            [req.user.id]
        );

        // Get recent activity (latest 5 file uploads)
        const [recentActivity] = await pool.execute(`
            SELECT c.name, f.filename, f.uploaded_at 
            FROM files f 
            JOIN customers c ON f.customer_id = c.id 
            WHERE c.created_by = ? 
            ORDER BY f.uploaded_at DESC 
            LIMIT 5
        `, [req.user.id]);

        // Send the response with the required dashboard stats
        res.send({
            totalCustomers: totalCustomers[0].count,
            totalFiles: totalFiles[0].count,
            recentActivity
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).send({ error: 'Failed to fetch dashboard data' });
    }
};
