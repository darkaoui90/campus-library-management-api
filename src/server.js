require("dotenv").config();


const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express() ;


app.use(cors());
app.use(express.json());




app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Campus Library API is running"
  });
});


const PORT = process.env.PORT || 5000;

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