require("dotenv").config();
const mongoose = require("mongoose");
const { runReminderJob } = require("../src/services/reminderService");
mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log(await runReminderJob());
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
