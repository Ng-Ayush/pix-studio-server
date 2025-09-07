require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const scheduleAdminExpiryCheck = require('./utils/cron.js');
scheduleAdminExpiryCheck();

// Create upload directory
const uploadDirectory = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Routes
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


if (cluster.isMaster) {

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
 
} else {
  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Worker ${process.pid} started on port ${PORT}`));

    app.use((req, res, next) => {
    next();
  });
};
