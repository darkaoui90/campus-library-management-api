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
app.use(cors());
app.use(express.json());




app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Campus Library API is running"
  });
});

app.use("/api/auth", authRoutes);



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





  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

  

 
module.exports = app;