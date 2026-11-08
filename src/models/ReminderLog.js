const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true },
  localDay: { type: String, required: true },
  status: { type: String, enum: ["pending", "sent", "failed", "skipped"], required: true },
  attempts: { type: Number, default: 0 },
  error: { type: String, default: "" },
  claimedAt: { type: Date, default: Date.now },
  sentAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ loanId: 1, localDay: 1 }, { unique: true });
module.exports = mongoose.model("ReminderLog", schema);
