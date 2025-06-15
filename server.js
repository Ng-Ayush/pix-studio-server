require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
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

app.get("/", (req, res) => {
    res.send({data:[{name:"test"}]});
})
// app.use('/api/mystudio/files', require('./routes/file.routes.js'));

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
