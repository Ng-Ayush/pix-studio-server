const pool = require('../db_config/db.js');
const waClients = require('../server.js');
// const twilio = require("twilio");
// const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
// CREATE

const puppeteer = require('puppeteer');
exports.generateInvoice = async (req, res) => {
  let { invoice_number, invoice_date, due_date, party_id, total, balance_left, invoice_type, payment_type = '', payment_type_description = '', invoice_items, time, phone_number, discount_value = '', discount_type = '' } = req.body;

  try {
    // Check if terms and conditions are provided
    if (!req.body.terms_and_condition) {
      return res.send({ error: 'Terms and conditions is required', message: "Terms and conditions is required", status: 400 });
    }

    const value = [invoice_number, invoice_date, due_date, party_id, 'Estimate Order', total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number, discount_value, discount_type, req.user.id];
    const [result] = await pool.execute(
      `INSERT INTO invoices (invoice_number,invoice_date,due_date,party_id,status,total,balance_left,invoice_type,payment_type,payment_type_description,invoice_items,time,phone_number,discount_value,discount_type,created_by) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, value);

    const invoice_id = result.insertId;

    // Create estimate
    const [row] = await pool.execute(
      `INSERT INTO estimates (invoice_id, terms_and_conditions,created_by) VALUES (?, ?, ?)`,
      [invoice_id, req.body.terms_and_condition, req.user.id]
    );

    for (const item of JSON.parse(invoice_items)) {
      if (item.id) {
        await pool.execute(
          `UPDATE invoice_items SET invoice_id = ?, status = 'finalized' WHERE id = ? AND created_by = ?`,
          [invoice_id, item.id, req.user.id]
        );
      } else {
        // New item - insert
        await pool.execute(
          `INSERT INTO invoice_items (invoice_id, created_by, item_name, description, sale_price, quantity, booking_date, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'finalized')`,
          [invoice_id, req.user.id, item.item_name, item.description, item.sale_price, item.quantity, item.booking_date, item.location]
        );
      }
    }

    res.send({ message: 'Invoice created', status: 200, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, err: err });
  }
};

// Helper function to check if invoice id is provided
const checkInvoiceId = async (invoice_number) => {
  const [rows] = await pool.execute(`SELECT id FROM invoices WHERE invoice_number = ?`, [invoice_number]);
  return rows.length > 0 ? rows[0].id : null;
};

// Helper function to check if estimate already exists for this invoice
const checkEstimateExists = async (invoice_id) => {
  const [rows] = await pool.execute(`SELECT id FROM estimates WHERE invoice_id = ?`, [invoice_id]);
  return rows.length > 0;
};

// READ ALL
exports.getAllInvoices = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE created_by = ?', [req.user.id]);
    res.json({ message: "Invoices fetched successfully", data: rows, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getPastPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM invoice_payments WHERE invoice_id = ?', [id]);
    res.json({ message: "Invoices Payment fetched successfully", data: rows, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ BY ID
exports.getInvoiceById = async (req, res) => {
  const { invoice_number } = req.params;
  try {
    const query = `SELECT inv.*,inv.id AS invoice_id, bc.party_name,bc.phone_number AS party_phone_number,bc.billing_address AS party_billing_address, est.id AS estimate_id, est.terms_and_conditions, est.status as estimate_status
  FROM invoices inv 
    LEFT JOIN billing_customer bc
    ON inv.party_id = bc.id
    LEFT JOIN estimates est
    ON inv.id = est.invoice_id
  WHERE inv.invoice_number = ? AND inv.created_by = ?`;

    const [rows] = await pool.execute(query, [invoice_number, req.user.id]);
    if (rows.length === 0) return res.json({ message: 'Invoice not found', status: 400 });

    const invoice = rows[0];
    const invoiceItemsArray = JSON.parse(invoice.invoice_items || "[]");

    const itemIds = invoiceItemsArray.map(item => item.id);

    // Step 3: Query invoice_items table for those IDs
    const [itemRows] = await pool.query(
      `SELECT id, item_name, quantity, description AS item_description, sale_price, amount, item_code, item_stock, created_at, booking_date, location, created_by 
   FROM invoice_items 
   WHERE id IN (?)`, [itemIds]
    );

    // Map static fields by id
    const staticItemsMap = {};
    itemRows.forEach(row => {
      staticItemsMap[row.id] = row;
    });

    // Step 4: Merge JSON data with static data for response
    const mergedInvoiceItems = invoiceItemsArray.map(jsonItem => {
      const staticItem = staticItemsMap[jsonItem.id] || {};
      return {
        id: jsonItem.id,
        item_name: staticItem.item_name,
        ...jsonItem
      };
    });

    const groupedInvoice = {
      invoice_number: rows[0].invoice_number,
      invoice_date: formatDate(rows[0].invoice_date),
      invoice_id: rows[0].invoice_id,
      due_date: formatDate(rows[0].due_date),
      party_id: rows[0].party_id,
      status: rows[0].status,
      total: rows[0].total,
      balance_left: rows[0].balance_left,
      invoice_type: rows[0].invoice_type,
      payment_type: rows[0].payment_type,
      payment_type_description: rows[0].payment_type_description,
      phone_number: rows[0].phone_number,
      time: rows[0].time,
      terms_and_conditions: rows[0].terms_and_conditions,
      estimate_status: rows[0].estimate_status,
      estimate_id: rows[0].estimate_id,
      party_name: rows[0].party_name,
      discount_type: rows[0].discount_type,
      discount_value: rows[0].discount_value,
      party_phone_number: rows[0].party_phone_number,
      party_billing_address: rows[0].party_billing_address,
      invoice_items: mergedInvoiceItems
    };
    res.json({ message: 'Invoice found', data: groupedInvoice, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInvoiceDetailByInvoiceNumber = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT inv.*, inv.id AS invoice_id
FROM invoices inv
WHERE invoice_number = ? AND inv.created_by = ?`;
    const [rows] = await pool.execute(query, [id, req.user.id]);
    if (rows.length === 0) return res.json({ message: 'Invoice not found', status: 400 });

    const invoice = rows[0];
    const invoiceItemsArray = JSON.parse(invoice.invoice_items || "[]");

    const itemIds = invoiceItemsArray.map(item => item.id);

    // Step 3: Query invoice_items table for those IDs
    const [itemRows] = await pool.query(
      `SELECT id, item_name, quantity, description AS item_description, sale_price, amount, item_code, item_stock, created_at, booking_date, location, created_by 
   FROM invoice_items 
   WHERE id IN (?)`, [itemIds]
    );

    // Map static fields by id
    const staticItemsMap = {};
    itemRows.forEach(row => {
      staticItemsMap[row.id] = row;
    });

    const mergedInvoiceItems = invoiceItemsArray.map(jsonItem => {
      const staticItem = staticItemsMap[jsonItem.id] || {};
      return {
        id: jsonItem.id,
        item_name: staticItem.item_name,
        ...jsonItem
      };
    });

    const groupedInvoice = {
      invoice_number: invoice.invoice_number,
      invoice_date: formatDate(invoice.invoice_date),
      invoice_id: invoice.invoice_id,
      due_date: formatDate(invoice.due_date),
      party_id: invoice.party_id,
      status: invoice.status,
      total: +invoice.total,
      balance_left: +invoice.balance_left,
      invoice_type: invoice.invoice_type,
      payment_type: invoice.payment_type,
      payment_type_description: invoice.payment_type_description,
      phone_number: invoice.phone_number,
      description: invoice.description,
      time: invoice.time,
      discount_type: invoice.discount_type,
      discount_value: +invoice.discount_value,
      invoice_items: mergedInvoiceItems
    };

    res.json({ message: 'Invoice found', data: groupedInvoice, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE 
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { invoice_number, invoice_date, due_date, party_id, status, total, balance_left, invoice_type, payment_type = '', payment_type_description = '', invoice_items, time, phone_number, discount_value = '', discount_type = '', terms_and_condition } = req.body;

  try {
    const query = `UPDATE invoices SET invoice_date = ?, due_date = ?, party_id = ?, status = ?,
        total = ?, balance_left = ?, invoice_type = ?, payment_type = ?, payment_type_description = ?, invoice_items = ?, time = ?, phone_number = ?, discount_value = ?, discount_type = ?
       WHERE id = ? AND created_by = ?`;
    const value = [invoice_date, due_date, party_id, status, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number, discount_value, discount_type, id, req.user.id];

    const [result] = await pool.execute(query, value);

    if (terms_and_condition) {
      const [check] = await pool.execute(`SELECT id FROM estimates WHERE invoice_id = ? AND created_by = ?`, [id, req.user.id]);
      if (check.length > 0) {
        const [row] = await pool.execute(
          `UPDATE estimates SET terms_and_conditions = ? WHERE invoice_id = ? AND created_by = ? `,
          [terms_and_condition, id, req.user.id]
        );
      } else {
        const [row] = await pool.execute(
          `INSERT INTO estimates (invoice_id, terms_and_conditions,created_by) VALUES (?, ?, ?)`,
          [id, terms_and_condition, req.user.id]
        );
      }
    }

    res.json({ message: 'Invoice updated', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err });
  }
};

// DELETE
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ? AND created_by = ?', [id, req.user.id]);
    res.send({ message: 'Invoices deleted', status: 200 });
  } catch (err) {
    res.send({ error: err.message, message: "Something Went wrong", status: 500 });
  }
};

exports.saveAdvancePayment = async (req, res) => {
  const { invoice_id, party_id, method, amount_paid, note = '' } = req.body;
  try {
    const query = `INSERT INTO invoice_payments (invoice_id,party_id,method,amount_paid,note) VALUES (?,?,?,?,?)`;
    const value = [invoice_id, party_id, method, amount_paid, note];
    const [result] = await pool.execute(query, value);
    const [invoiceRow] = await pool.execute(`UPDATE invoices
       SET balance_left = balance_left - ?
       WHERE id = ?`,
      [amount_paid, invoice_id]);;


    res.send({ message: 'Advance payment saved', status: 200 });
  } catch (err) {
    res.send({ error: err.message, status: 500 });
  }
}

exports.getLastInvoiceNumber = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT invoice_number as lastId FROM invoices WHERE created_by = ? ORDER BY id DESC LIMIT 1', [req.user.id]
    );

    const lastId = rows.length > 0 ? rows[0].lastId : 0; // ✅ safe check

    res.send({
      status: 200,
      lastInvoiceId: lastId,
    });
  } catch (error) {
    console.error('Error fetching last invoice ID:', error);
    res.status(500).json({ message: 'Internal Server Error' });
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


function getClientOrFail(userId, res) {
  const client = waClients.get(userId);
  if (!client) {
    res.send({ error: "WhatsApp not connected", status: 503 });
    return null;
  }
  return client;
}



exports.sendPdfViaWhatsApp = async (req, res) => {
  try {
    const { number, pdfBase64, fileName } = req.body;
    const userId = req.user.id;

    const client = getClientOrFail(userId, res);
    if (!client) return;

    // const chatId = `${number}@c.us`;
    const chatId = number;

    // save base64 to temp file
    const base64Data = pdfBase64.startsWith('data:')
      ? pdfBase64
      : `data:application/pdf;base64,${pdfBase64}`;

    await client.sendFile(
      chatId,
      base64Data,
      fileName || 'invoice.pdf',
      'Here is your PDF 📄'
    );

    res.send({ success: 200 });

  } catch (err) {
    console.error(err);
    res.send({ error: err.message, status: 500 });
  }
};

exports.sendBulkMessage = async (req, res) => {
  try {
    const { numbers, message } = req.body;
    const userId = req.user.id;

    const client = getClientOrFail(userId, res);
    if (!client) return;

    const results = [];

    for (const number of numbers) {
      const chatId = `${number}@c.us`;

      console.log("CHAT ID +++++++++++",chatId);
      
      try {
        await client.sendText(chatId, message);
        results.push({ number, success: true });

        // 🛑 throttle to avoid bans
        await new Promise(r => setTimeout(r, 1500));

      } catch (err) {
        results.push({ number, success: false, error: err.message });
      }
    }

    res.send({ success: 200, results });

  } catch (err) {
    res.send({ error: err.message, status: 500 });
  }
};



// exports.sendPdfViaWhatsApp = async (req, res) => {
//   try {
//     const { number, pdfBase64, fileName } = req.body;
//     const userId = req.user.id;
//     const client = clients.get(userId);

//     console.log(clients);



//     if (!client || !client.isReady) {
//       return res.status(503).json({ error: "WhatsApp client not connected or ready." });
//     }

//     const [rows] = await pool.query(`
//       SELECT status FROM whatsapp_sessions WHERE user_id=? AND status='ready' LIMIT 1
//     `, [userId]);

//     if (rows.length === 0) {
//       return res.status(503).json({ error: "WhatsApp session is not active in database." });
//     }

//     const media = new MessageMedia('application/pdf', pdfBase64, fileName || 'invoice.pdf');
//     await client.sendMessage(number, media);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message, err });
//   }
// };

// exports.sendBulkMessage = async (req, res) => {
//   try {
//     const { numbers, message } = req.body;
//     const userId = req.user.id;

//     const client = clients.get(userId);
//     const results = [];

//     for (const number of numbers) {
//       try {
//         const waId = `91${number}@c.us`;
//         await client.sendMessage(waId, message);
//         results.push({ number, success: true });
//       } catch (error) {
//         results.push({ number, success: false, error: error.message });
//       }
//     }

//     res.json({ status: 200, results });

//   } catch (err) {
//     res.status(500).json({ success: false, status: 500, error: err.message });
//   }
// };

exports.generatePdf = async (req, res) => {

  try {
    const { html } = req.body;

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--allow-running-insecure-content",
      ],
    });

    const page = await browser.newPage();

    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
      waitUntil: "networkidle2",
    });

    await page.evaluate(async () => {
      const selectors = Array.from(document.images).map(img => img.complete
        ? Promise.resolve()
        : new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        })
      );
      await Promise.all(selectors);
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=invoice.pdf"
    );

    res.end(pdfBuffer); // <-- IMPORTANT: use end() not send()
  } catch (err) {
    console.error("PDF ERROR:", err);
    res.status(500).send("Failed to generate PDF");
  }
};