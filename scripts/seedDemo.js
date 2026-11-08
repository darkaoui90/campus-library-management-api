require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Book = require("../src/models/Book");
const Copy = require("../src/models/Copy");
const Loan = require("../src/models/Loan");

async function seed() {
  if (process.env.NODE_ENV === "production" || process.env.DEMO_SEED_ALLOWED !== "true") {
    throw new Error("Demo seed requires DEMO_SEED_ALLOWED=true and a non-production environment");
  }
  const users = [
    ["manager", "Library Manager", process.env.SEED_MANAGER_EMAIL, process.env.SEED_MANAGER_PASSWORD],
    ["admin", "Administrator", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD],
    ["learner", "Learner One", process.env.SEED_LEARNER1_EMAIL, process.env.SEED_LEARNER1_PASSWORD],
    ["learner", "Learner Two", process.env.SEED_LEARNER2_EMAIL, process.env.SEED_LEARNER2_PASSWORD]
  ];
  if (users.some(row => !row[2] || !row[3] || row[3].length < 8)) throw new Error("Set all seed account emails and passwords (min 8 characters)");
  await mongoose.connect(process.env.MONGO_URI);
  const saved = {};
  for (const [role, name, rawEmail, password] of users) {
    const email = rawEmail.trim().toLowerCase();
    let user = await User.findOne({ email });
    if (user && user.role !== role) throw new Error(`Existing account ${email} has another role`);
    if (!user) user = await User.create({ role, name, email, password });
    saved[role + (role === "learner" ? (name.endsWith("One") ? "1" : "2") : "")] = user;
  }
  const titles = [["Node.js Basics", "Campus Library"], ["MongoDB Essentials", "Campus Library"], ["Express Guide", "Campus Library"]];
  const books = [];
  for (const [title, author] of titles) {
    let book = await Book.findOne({ title, author });
    if (!book) book = await Book.create({ title, author });
    books.push(book);
  }
  const copies = [];
  for (let i = 0; i < 5; i++) {
    const inventoryCode = `DEMO-00${i + 1}`;
    let copy = await Copy.findOne({ inventoryCode });
    if (copy && String(copy.bookId) !== String(books[Math.min(i, 2)]._id)) throw new Error(`Inventory code ${inventoryCode} belongs to another book`);
    if (!copy) copy = await Copy.create({ inventoryCode, bookId: books[Math.min(i, 2)]._id });
    copies.push(copy);
  }
  await Loan.init();
  const now = Date.now();
  const examples = [
    { copy: copies[0], learner: saved.learner1, borrowedAt: new Date(now - 86400000), dueAt: new Date(now + 13 * 86400000) },
    { copy: copies[1], learner: saved.learner2, borrowedAt: new Date(now - 20 * 86400000), dueAt: new Date(now - 6 * 86400000) }
  ];
  for (const item of examples) {
    if (!(await Loan.exists({ copyId: item.copy._id, returnedAt: null }))) {
      await Loan.create({ copyId: item.copy._id, borrowerId: item.learner._id, issuedBy: saved.manager._id,
        borrowedAt: item.borrowedAt, dueAt: item.dueAt, durationDays: 14 });
    }
  }
  console.log("Demo seed ready: 3 books, 5 copies, 4 users, 2 example active loans (existing records preserved)");
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
