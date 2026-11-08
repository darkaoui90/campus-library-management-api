const AppConfig = require("../models/AppConfig");

async function getConfig() {
  return AppConfig.findByIdAndUpdate("main", { $setOnInsert: { _id: "main" } },
    { upsert: true, new: true, setDefaultsOnInsert: true });
}

module.exports = { getConfig };
