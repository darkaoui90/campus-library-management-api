const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const { createLoan, returnLoan } = require("../services/loanService");
const { sendLoanEmail } = require("../services/emailService");

function fail(res, error) {
  if (!error.status) console.error("Loan error:", error);
  return res.status(error.status || 500).json({ message: error.status ? error.message : "Internal server error" });
}

async function issue(req, res) {
  try {
    const loan = await createLoan(req.body?.copyId, req.body?.borrowerId, req.user.id);
    const populated = await Loan.findById(loan._id).populate("borrowerId", "name email")
      .populate({ path: "copyId", populate: { path: "bookId", select: "title" } });
    let email;
    try { email = await sendLoanEmail(populated, "confirmation"); }
    catch (error) { console.error("Confirmation email failed:", loan._id.toString(), error.message); email = { status: "failed" }; }
    return res.status(201).json({ loan, email });
  } catch (error) { return fail(res, error); }
}

async function finish(req, res) {
  try { return res.json({ loan: await returnLoan(req.params.id, req.user.id) }); }
  catch (error) { return fail(res, error); }
}

async function list(req, res) {
  try {
    const filter = {};
    if (req.user.role === "learner") filter.borrowerId = req.user.id;
    else if (req.query.borrowerId) {
      if (!mongoose.isValidObjectId(req.query.borrowerId)) return res.status(400).json({ message: "Invalid borrower ID" });
      filter.borrowerId = req.query.borrowerId;
    }
    const status = req.query.status;
    if (status && !["active", "overdue", "returned"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (status === "returned") filter.returnedAt = { $ne: null };
    if (status === "active") filter.returnedAt = null;
    if (status === "overdue") { filter.returnedAt = null; filter.dueAt = { $lt: new Date() }; }
    const loans = await Loan.find(filter).sort({ borrowedAt: -1 }).populate("copyId", "bookId inventoryCode");
    return res.json(loans);
  } catch (error) { return fail(res, error); }
}

module.exports = { issue, finish, list };
