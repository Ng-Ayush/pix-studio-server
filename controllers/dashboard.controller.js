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
        const [rows] = await pool.execute('SELECT cus.name AS party_name,cus.phone AS phone_number,ev.event_name,ev.created_at FROM events ev JOIN customers cus ON cus.id = ev.customer_id WHERE ev.created_by = ?', [req.user.id]);
        const groupedByDate = {};

        rows.forEach((event,idx) => {
            const date = formatDate(event.created_at);

            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }

            groupedByDate[date].push({
                name: event.party_name,
                phone: event.phone_number,
                event_name: event.event_name,
                index: idx,
                date: date
            });
        });
        res.send({ message: "Calendar events fetched successfully", data: groupedByDate, status: 200 });
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch calendar events', error });
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