const Loan = require("../models/Loan");
require("../models/User");
require("../models/Copy");
require("../models/Book");
const ReminderLog = require("../models/ReminderLog");
const AppConfig = require("../models/AppConfig");
const { getConfig } = require("./configService");
const { sendLoanEmail } = require("./emailService");

function localDay(date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", year: "numeric",
    month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function runReminderJob() {
  const now = new Date();
  const result = { startedAt: now, selected: 0, sent: 0, skipped: 0, errors: 0 };
  const config = await getConfig();
  if (!config.reminderJobEnabled || !config.emailEnabled) {
    result.skipped = 1;
    result.reason = !config.reminderJobEnabled ? "Job disabled" : "Email disabled";
    await AppConfig.updateOne({ _id: "main" }, { $set: { lastReminderRun: result } });
    return result;
  }
  const deadline = new Date(now.getTime() + config.reminderAnticipationDays * 86400000);
  const loans = await Loan.find({ returnedAt: null, dueAt: { $lte: deadline } })
    .populate("borrowerId", "name email remindersEnabled")
    .populate({ path: "copyId", select: "inventoryCode bookId", populate: { path: "bookId", select: "title" } });
  const day = localDay(now);
  for (const loan of loans) {
    if (!loan.borrowerId || !loan.borrowerId.remindersEnabled || !loan.copyId || !loan.copyId.bookId) {
      result.skipped++;
      continue;
    }
    result.selected++;
    let claim;
    try {
      claim = await ReminderLog.create({ loanId: loan._id, localDay: day, status: "pending", attempts: 1 });
    } catch (error) {
      if (error.code !== 11000) { result.errors++; continue; }
      // A failed attempt can be retried. A recent pending attempt remains claimed.
      claim = await ReminderLog.findOneAndUpdate({ loanId: loan._id, localDay: day, status: "failed" },
        { $set: { status: "pending", claimedAt: now }, $inc: { attempts: 1 } }, { new: true });
      if (!claim) { result.skipped++; continue; }
    }
    try {
      const sent = await sendLoanEmail(loan, "reminder");
      claim.status = sent.status;
      if (sent.status === "sent") { claim.sentAt = new Date(); result.sent++; }
      else result.skipped++;
    } catch (error) {
      claim.status = "failed";
      claim.error = error.message;
      result.errors++;
      console.error("Reminder email failed:", loan._id.toString(), error.message);
    }
    await claim.save();
  }
  result.finishedAt = new Date();
  await AppConfig.updateOne({ _id: "main" }, { $set: { lastReminderRun: result } });
  return result;
}

module.exports = { runReminderJob, localDay };
