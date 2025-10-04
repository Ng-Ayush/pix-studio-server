require("dotenv").config();
const express = require("express");
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const scheduleAdminExpiryCheck = require('./utils/cron.js');

scheduleAdminExpiryCheck();

// Create upload directory once
const uploadDirectory = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.static("public"));

app.use(bodyParser.json({ limit: '10mb' }));

// Map to hold WhatsApp clients keyed by user_id
const clients = new Map();

// Make io and clients accessible in req.app.locals for controllers
app.locals.io = io;
app.locals.clients = clients;

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('register', (userId) => {
    console.log(`Socket joined room for user: ${userId}`);
    socket.join(`user_${userId}`);
  });
});

// Your WhatsApp client creation and event emitting should happen on-demand, e.g., inside your OTP controller by accessing app.locals.clients and app.locals.io

// Register your routes after app.locals setup
app.use("/api/mystudio/auth", require("./routes/auth.routes.js"));
app.use("/api/mystudio/admin", require("./routes/user.routes.js"));
app.use("/api/mystudio/customers", require("./routes/customer.routes.js"));
app.use("/api/mystudio/dashboard", require("./routes/dashboard.routes.js"));
app.use("/api/mystudio/otp", require("./routes/otp.routes.js"));
app.use("/api/mystudio/photo-selection", require("./routes/photo-selection.routes.js"));
app.use("/api/mystudio/billing-customer", require("./routes/billingCustomerRoutes.js"));
app.use("/api/mystudio/invoice-items", require("./routes/invoiceItemsRoutes.js"));
app.use("/api/mystudio/invoices", require("./routes/invoices.route.js"));
app.use("/api/mystudio/estimates", require("./routes/estimates.routes.js"));
app.use("/api/mystudio/super-admin", require("./routes/admin.routes.js"));
app.use("/api/mystudio/manage-features", require("./routes/manageFeatureRoute.js"));
app.use("/api/mystudio/customer-request", require("./routes/customerRequestRoute.js"));
app.use("/api/mystudio/manage-profile", require("./routes/manageProfileRoute.js"));
app.use("/api/mystudio/calling", require("./routes/calling.routes.js"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
