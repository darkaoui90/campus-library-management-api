const router = require("express").Router();
const { authenticate, authorizeRoles } = require("../middlewares/authMiddleware");
const { showConfig, updateConfig, runReminders } = require("../controllers/adminController");
router.use(authenticate, authorizeRoles("admin"));
router.get("/config", showConfig);
router.patch("/config", updateConfig);
router.post("/jobs/loan-reminders", runReminders);
module.exports = router;
