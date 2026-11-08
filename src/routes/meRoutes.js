const router = require("express").Router();
const User = require("../models/User");
const { authenticate, authorizeRoles } = require("../middlewares/authMiddleware");
router.get("/reminders", authenticate, authorizeRoles("learner"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ remindersEnabled: user.remindersEnabled });
  } catch (error) { res.status(500).json({ message: "Internal server error" }); }
});
router.patch("/reminders", authenticate, authorizeRoles("learner"), async (req, res) => {
  if (!req.body || typeof req.body.remindersEnabled !== "boolean" || Object.keys(req.body).length !== 1) {
    return res.status(400).json({ message: "remindersEnabled must be a boolean" });
  }
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { remindersEnabled: req.body.remindersEnabled }, { new: true });
    res.json({ remindersEnabled: user.remindersEnabled });
  } catch (error) { res.status(500).json({ message: "Internal server error" }); }
});
module.exports = router;
