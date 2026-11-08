const router = require("express").Router();
const { authenticate, authorizeRoles } = require("../middlewares/authMiddleware");
const { issue, finish, list } = require("../controllers/loanController");
router.use(authenticate);
router.get("/", list);
router.post("/", authorizeRoles("manager", "admin"), issue);
router.patch("/:id/return", authorizeRoles("manager", "admin"), finish);
module.exports = router;
