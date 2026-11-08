const AppConfig = require("../models/AppConfig");
const { getConfig } = require("../services/configService");
const { runReminderJob } = require("../services/reminderService");

async function showConfig(req, res) {
  try { res.json(await getConfig()); }
  catch (error) { console.error(error); res.status(500).json({ message: "Internal server error" }); }
}

async function updateConfig(req, res) {
  const allowed = ["loanDurationDays", "emailEnabled", "reminderJobEnabled", "reminderFrequency", "reminderAnticipationDays"];
  if (!req.body || Object.keys(req.body).some(key => !allowed.includes(key)) || !Object.keys(req.body).length) {
    return res.status(400).json({ message: "Invalid configuration fields" });
  }
  const { loanDurationDays, emailEnabled, reminderJobEnabled, reminderFrequency, reminderAnticipationDays } = req.body;
  if ((loanDurationDays !== undefined && (!Number.isInteger(loanDurationDays) || loanDurationDays < 1 || loanDurationDays > 30)) ||
      (reminderAnticipationDays !== undefined && (!Number.isInteger(reminderAnticipationDays) || reminderAnticipationDays < 0 || reminderAnticipationDays > 7)) ||
      (emailEnabled !== undefined && typeof emailEnabled !== "boolean") ||
      (reminderJobEnabled !== undefined && typeof reminderJobEnabled !== "boolean") ||
      (reminderFrequency !== undefined && !["hourly", "daily"].includes(reminderFrequency))) {
    return res.status(400).json({ message: "Invalid configuration value" });
  }
  try {
    await getConfig();
    const config = await AppConfig.findByIdAndUpdate("main", { $set: req.body }, { new: true, runValidators: true });
    res.json(config);
  } catch (error) { console.error(error); res.status(500).json({ message: "Internal server error" }); }
}

async function runReminders(req, res) {
  try { res.json(await runReminderJob()); }
  catch (error) { console.error(error); res.status(500).json({ message: "Internal server error" }); }
}

module.exports = { showConfig, updateConfig, runReminders };
