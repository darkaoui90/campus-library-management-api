require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User");
const connectDB = require("../src/config/db");

const users = [
  {
    name: "Library Manager",
    email: process.env.SEED_MANAGER_EMAIL,
    password: process.env.SEED_MANAGER_PASSWORD,
    role: "manager"
  },
  {
    name: "Administrator",
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    role: "admin"
  }
];

const seedUsers = async () => {
  try {
   
    for (const user of users) {
      if (!user.email || !user.password || user.password.length < 8) {
        throw new Error(`Invalid credentials for ${user.role}`);
      }
    }

    if (users[0].email.toLowerCase() === users[1].email.toLowerCase()) {
      throw new Error("Manager and admin must have different emails");
    }

    await connectDB();

    for (const user of users) {
      const email = user.email.trim().toLowerCase();

      const existingUser = await User.findOne({ email });

      if (existingUser) {
        if (existingUser.role !== user.role) {
          throw new Error(
            `Account ${email} already exists with another role`
          );
        }

        console.log(`${user.role} already exists. Skipped.`);
        continue;
      }

      
      await User.create({
        name: user.name,
        email,
        password: user.password,
        role: user.role
      });

      console.log(`${user.role} created successfully`);
    }
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedUsers();