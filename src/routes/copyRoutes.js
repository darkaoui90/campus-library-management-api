const express = require("express");
const router = express.Router();

const {
  createCopy,
  getCopies
} = require("../controllers/CopyController");

const {
  authenticate,
  authorizeRoles
} = require("../middlewares/authMiddleware");


router.post(
  "/",
  authenticate,
  authorizeRoles("manager", "admin"),
  createCopy
);


router.get(
  "/book/:bookId",
  authenticate,
  getCopies
);

module.exports = router;
