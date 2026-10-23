const express = require("express");
const router = express.Router();

const { register } = require("../src/controllers/authController");

router.post("/register", register);

module.exports = router;