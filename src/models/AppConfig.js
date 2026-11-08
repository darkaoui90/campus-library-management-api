const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  _id: { type: String, default: "main" },
  loanDurationDays: { type: Number, default: 14, min: 1, max: 30 },
  emailEnabled: { type: Boolean, default: true },
  reminderJobEnabled: { type: Boolean, default: true },
  reminderFrequency: { type: String, enum: ["hourly", "daily"], default: "daily" },
  reminderAnticipationDays: { type: Number, default: 2, min: 0, max: 7 },
  lastReminderRun: { type: mongoose.Schema.Types.Mixed, default: null }
});

module.exports = mongoose.model("AppConfig", schema);
