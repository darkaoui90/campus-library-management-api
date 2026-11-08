const cron = require("node-cron");
const { getConfig } = require("./configService");
const { runReminderJob } = require("./reminderService");

function startCron() {
  // Only the API process starts this scheduler. Both schedules check current config.
  cron.schedule("0 * * * *", async () => {
    try {
      const config = await getConfig();
      const localHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23",
        timeZone: "Africa/Casablanca" }).format(new Date()));
      if (config.reminderFrequency === "hourly" || localHour === 9) await runReminderJob();
    } catch (error) { console.error("Scheduled reminder failed:", error); }
  }, { timezone: "Africa/Casablanca" });
}
module.exports = { startCron };
