const pool = require('../db_config/db.js'); // Assuming this is your MySQL connection pool

exports.fetchSalesAndPendingGraphData = async (req, res) => {
    try {
        const granularity = req.query.range || 'monthly';

        let periodColumn;
        switch (granularity) {
            case 'daily':
                periodColumn = `DATE(created_at)`;
                break;
            case 'weekly':
                periodColumn = `YEARWEEK(created_at, 1)`;
                break;
            case 'monthly':
            default:
                periodColumn = `DATE_FORMAT(created_at, '%Y-%m')`;
                break;
        }

        const salesQuery = `
    SELECT ${periodColumn} AS period, SUM(total) AS amount
    FROM invoices
    WHERE invoice_type = 'sale' AND created_by = ?
    GROUP BY period
    ORDER BY period ASC
  `;
        const estimateQuery = `
    SELECT ${periodColumn} AS period, SUM(total) AS amount
    FROM invoices
    WHERE invoice_type = 'estimate' AND created_by = ?
    GROUP BY period
    ORDER BY period ASC
  `;

        const [sales] = await pool.execute(salesQuery, [req.user.id]);
        const [estimates] = await pool.execute(estimateQuery, [req.user.id]);

        res.send({ message: "Dashboard data fetched successfully", sales, estimates, status: 200 });
    }
    catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).send({ error: 'Failed to fetch dashboard data' });
    }
};

exports.getCalendarEvents = async (req, res) => {
    try {
        const sql = `
      WITH RECURSIVE seq AS (
        SELECT 0 AS idx
        UNION ALL
        SELECT idx + 1 FROM seq WHERE idx + 1 < 1000
      )
      SELECT
        DATE_FORMAT(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(inv.invoice_items, CONCAT('$[', seq.idx, '].booking_date'))) AS DATE),
          '%Y-%m-%d'
        ) AS booking_date,
        cus.party_name  AS party_name,
        cus.phone_number AS party_phone_number,
        inv.id    AS invoice_id,
        CAST(JSON_UNQUOTE(JSON_EXTRACT(inv.invoice_items, CONCAT('$[', seq.idx, '].id'))) AS UNSIGNED) AS item_id,
         ii.item_name,
         ii.description
      FROM invoices inv
      JOIN billing_customer cus ON cus.id = inv.party_id
      JOIN seq ON seq.idx < COALESCE(JSON_LENGTH(inv.invoice_items), 0)
      LEFT JOIN invoice_items ii
  ON ii.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(inv.invoice_items, CONCAT('$[', seq.idx, '].id'))) AS UNSIGNED)
      WHERE inv.created_by = ?
      ORDER BY booking_date;
    `;

        const [rows] = await pool.execute(sql, [req.user.id]);

        const groupedByDate = {};
        rows.forEach((r, idx) => {
            if (!r.booking_date) return; // skip malformed/null dates
            const date = r.booking_date;

            if (!groupedByDate[date]) groupedByDate[date] = [];
            groupedByDate[date].push({
                name: r.party_name,
                phone: r.party_phone_number,
                invoice_id: r.invoice_id,
                item_id: r.item_id,
                location: r.location,
                index: idx,
                item_name: r.item_name,
                description: r.description,
                date,
            });
        });

        res.send({ message: 'Calendar events fetched successfully', data: groupedByDate, status: 200 });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to fetch calendar events', details: error.message });
    }
};

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}