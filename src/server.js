require("dotenv").config();


const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express() ;
const authRoutes = require("./routes/authRoutes");
const {
  authenticate,
  authorizeRoles
} = require("./middlewares/authMiddleware"); 
const bookRoutes = require("./routes/bookRoutes");
const copyRoutes = require("./routes/copyRoutes");
const loanRoutes = require("./routes/loanRoutes");
const adminRoutes = require("./routes/adminRoutes");
const statsRoutes = require("./routes/statsRoutes");
const meRoutes = require("./routes/meRoutes");
const Loan = require("./models/Loan");
app.use(cors());
app.use(express.json());




app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Campus Library API is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/copies", copyRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/me", meRoutes);
const swaggerUi = require("swagger-ui-express");
const openapi = require("../docs/openapi");
app.get("/api/docs", swaggerUi.setup(openapi));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));



const PORT = process.env.PORT || 5000;


app.get(
  "/api/test/manager",
  authenticate,
  authorizeRoles("manager", "admin"),
  (req, res) => {
    res.status(200).json({
      message: "Welcome, you have manager access"
    });
  }
);

const startServer = async () => {
  await connectDB();
  await Loan.init();
  if (process.env.RUN_REMINDER_CRON !== "false") require("./services/cronService").startCron();





  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

  

 
module.exports = app;
