const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
  copyId: { type: mongoose.Schema.Types.ObjectId, ref: "Copy", required: true },
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  borrowedAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  returnedAt: { type: Date, default: null },
  returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  durationDays: { type: Number, required: true }
}, { timestamps: true });

// MongoDB enforces this even when two requests create a loan at the same time.
loanSchema.index({ copyId: 1 }, { unique: true, partialFilterExpression: { returnedAt: null } });

module.exports = mongoose.model("Loan", loanSchema);
