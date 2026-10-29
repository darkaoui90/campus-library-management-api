const express = require("express");
const router = express.Router();

const {
  createBook,
  getBooks,
  getBookById,
  updateBook
} = require("../controllers/bookController");


const {
  authenticate,
  authorizeRoles
} = require("../middlewares/authMiddleware");


router.get("/" , authenticate , getBooks) ;



router.get("/:id", authenticate, getBookById);


router.post(
  "/",
  authenticate,
  authorizeRoles("manager", "admin"),
  createBook
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("manager", "admin"),
  updateBook
);


module.exports = router;