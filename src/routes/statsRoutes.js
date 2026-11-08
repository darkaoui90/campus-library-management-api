const router = require("express").Router();
const Copy = require("../models/Copy");
const Loan = require("../models/Loan");
const { authenticate, authorizeRoles } = require("../middlewares/authMiddleware");
router.get("/", authenticate, authorizeRoles("manager", "admin"), async (req, res) => {
  try {
    const [totalCopies, activeLoans, overdueLoans] = await Promise.all([
      Copy.countDocuments(), Loan.countDocuments({ returnedAt: null }),
      Loan.countDocuments({ returnedAt: null, dueAt: { $lt: new Date() } })
    ]);
    res.json({ totalCopies, availableCopies: totalCopies - activeLoans, activeLoans, overdueLoans });
  } catch (error) { console.error(error); res.status(500).json({ message: "Internal server error" }); }
});
module.exports = router;
