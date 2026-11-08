const mongoose = require("mongoose");
const Copy = require("../models/Copy");
const User = require("../models/User");
const Loan = require("../models/Loan");
const { getConfig } = require("./configService");

function problem(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function createLoan(copyId, borrowerId, staffId) {
  if (!mongoose.isValidObjectId(copyId) || !mongoose.isValidObjectId(borrowerId)) {
    throw problem(400, "Valid copyId and borrowerId are required");
  }
  const [copy, borrower, config] = await Promise.all([
    Copy.findById(copyId), User.findById(borrowerId), getConfig()
  ]);
  if (!copy) throw problem(404, "Copy not found");
  if (!borrower || borrower.role !== "learner") throw problem(404, "Learner not found");
  const borrowedAt = new Date();
  const dueAt = new Date(borrowedAt.getTime() + config.loanDurationDays * 86400000);
  try {
    return await Loan.create({ copyId, borrowerId, issuedBy: staffId, borrowedAt, dueAt,
      durationDays: config.loanDurationDays });
  } catch (error) {
    if (error.code === 11000) throw problem(409, "Copy is already borrowed");
    throw error;
  }
}

async function returnLoan(id, staffId) {
  if (!mongoose.isValidObjectId(id)) throw problem(400, "Invalid loan ID");
  const loan = await Loan.findOneAndUpdate({ _id: id, returnedAt: null },
    { $set: { returnedAt: new Date(), returnedBy: staffId } }, { new: true });
  if (loan) return loan;
  const existing = await Loan.findById(id);
  if (!existing) throw problem(404, "Loan not found");
  return existing;
}

module.exports = { createLoan, returnLoan };
