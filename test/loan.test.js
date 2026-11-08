// Integration tests require MongoDB running on the local Docker port 27017.
// IMPORTANT: These tests erase records ONLY in the dedicated *_test database.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-jwt-signing-key-not-for-production";
process.env.EMAIL_MODE = "log";
process.env.RUN_REMINDER_CRON = "false";
jest.setTimeout(30000);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/server");
const User = require("../src/models/User");
const Book = require("../src/models/Book");
const Copy = require("../src/models/Copy");
const Loan = require("../src/models/Loan");
const AppConfig = require("../src/models/AppConfig");
const ReminderLog = require("../src/models/ReminderLog");
const { runReminderJob } = require("../src/services/reminderService");

let manager, admin, student1, student2, copy, token;
const auth = user => "Bearer " + jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI || "mongodb://127.0.0.1:27017/campus_library_test";
  // A second check below prevents running destructive tests on dev/production DBs.
  const dbName = new URL(uri).pathname.slice(1);
  if (!dbName.endsWith("_test") || dbName === "_test") {
    throw new Error("Refusing to run tests outside a named *_test database");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  if (mongoose.connection.name !== dbName || process.env.NODE_ENV !== "test") {
    throw new Error("Unsafe test database");
  }
  await Promise.all([Loan.init(), ReminderLog.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!mongoose.connection.name.endsWith("_test")) throw new Error("Unsafe test deletion");
  for (const Model of [ReminderLog, Loan, Copy, Book, User, AppConfig]) {
    await Model.deleteMany({});
  }
  manager = await User.create({ name: "Manager", email: "manager@test.local", password: "ManagerPass123!", role: "manager" });
  admin = await User.create({ name: "Admin", email: "admin@test.local", password: "AdminPass123!", role: "admin" });
  student1 = await User.create({ name: "Learner One", email: "student1@test.local", password: "StudentPass123!", role: "learner" });
  student2 = await User.create({ name: "Learner Two", email: "student2@test.local", password: "StudentPass123!", role: "learner" });
  const book = await Book.create({ title: "Node Basics", author: "Test Author" });
  copy = await Copy.create({ bookId: book._id, inventoryCode: "TEST-001" });
  token = auth(manager);
});

test("missing token is 401; learner cannot issue a loan", async () => {
  const data = { copyId: String(copy._id), borrowerId: String(student1._id) };
  expect((await request(app).post("/api/loans").send(data)).status).toBe(401);
  expect((await request(app).post("/api/loans").set("Authorization", auth(student1)).send(data)).status).toBe(403);
});

test("loan dates are calculated by server and do not change after config update", async () => {
  const response = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id), dueAt: "2000-01-01" });
  expect(response.status).toBe(201);
  expect(response.body.loan.durationDays).toBe(14);
  const firstDue = response.body.loan.dueAt;
  expect(new Date(firstDue).getTime() - new Date(response.body.loan.borrowedAt).getTime()).toBe(14*24*60*60*1000);
  const changed = await request(app).patch("/api/admin/config").set("Authorization", auth(admin))
    .send({ loanDurationDays: 21 });
  expect(changed.status).toBe(200);
  const original = await Loan.findById(response.body.loan._id);
  expect(original.dueAt.toISOString()).toBe(firstDue);
});

test("two simultaneous loans: only one succeeds, loser gets 409", async () => {
  const data = { copyId: String(copy._id), borrowerId: String(student1._id) };
  const responses = await Promise.all([
    request(app).post("/api/loans").set("Authorization", token).send(data),
    request(app).post("/api/loans").set("Authorization", token).send(data)
  ]);
  expect(responses.map(x => x.status).sort()).toEqual([201, 409]);
  expect(await Loan.countDocuments({ copyId: copy._id, returnedAt: null })).toBe(1);
});

test("missing copy cannot create a partially saved loan", async () => {
  const response = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(new mongoose.Types.ObjectId()), borrowerId: String(student1._id) });
  expect(response.status).toBe(404);
  expect(await Loan.countDocuments()).toBe(0);
});

test("return is idempotent and copy can be borrowed again", async () => {
  const start = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  const loanId = start.body.loan._id;
  const first = await request(app).patch(`/api/loans/${loanId}/return`).set("Authorization", token);
  const second = await request(app).patch(`/api/loans/${loanId}/return`).set("Authorization", token);
  expect(first.status).toBe(200);
  expect(first.body.loan.returnedAt).toBe(second.body.loan.returnedAt);
  const next = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student2._id) });
  expect(next.status).toBe(201);
});

test("a learner sees only their own loans", async () => {
  await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  const mine = await request(app).get("/api/loans").set("Authorization", auth(student1));
  const other = await request(app).get("/api/loans").set("Authorization", auth(student2));
  expect(mine.body).toHaveLength(1);
  expect(other.body).toHaveLength(0);
});

test("admin settings protected against manager and invalid duration", async () => {
  expect((await request(app).patch("/api/admin/config")
    .set("Authorization", token).send({ loanDurationDays: 21 })).status).toBe(403);
  expect((await request(app).patch("/api/admin/config")
    .set("Authorization", auth(admin)).send({ loanDurationDays: 31 })).status).toBe(400);
});

test("reminder job sends once per day, skips opted-out learner and returned loan", async () => {
  const newCopy = await Copy.create({ bookId: copy.bookId, inventoryCode: "TEST-002" });
  const old = new Date(Date.now() - 2*24*60*60*1000);
  const loan1 = await Loan.create({ copyId: copy._id, borrowerId: student1._id, issuedBy: manager._id, borrowedAt: old, dueAt: old, durationDays: 1 });
  await Loan.create({ copyId: newCopy._id, borrowerId: student2._id, issuedBy: manager._id, borrowedAt: old, dueAt: old, durationDays: 1 });
  await User.findByIdAndUpdate(student2._id, { remindersEnabled: false });
  const first = await runReminderJob();
  const second = await runReminderJob();
  expect(first.sent).toBe(1);
  expect(second.sent).toBe(0);
  expect(await ReminderLog.countDocuments({ loanId: loan1._id, status: "sent" })).toBe(1);
  await Loan.findByIdAndUpdate(loan1._id, { returnedAt: new Date(), returnedBy: manager._id });
  const third = await runReminderJob();
  expect(third.sent).toBe(0);
});

test("simultaneous reminder jobs send one ordinary reminder", async () => {
  const old = new Date(Date.now() - 3 * 86400000);
  const loan = await Loan.create({ copyId: copy._id, borrowerId: student1._id, issuedBy: manager._id,
    borrowedAt: old, dueAt: old, durationDays: 1 });
  const results = await Promise.all([runReminderJob(), runReminderJob()]);
  expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
  expect(await ReminderLog.countDocuments({ loanId: loan._id, status: "sent" })).toBe(1);
});

test("registration fixes learner role and never exposes a password", async () => {
  const response = await request(app).post("/api/auth/register")
    .send({ name: "New Learner", email: "NEW@TEST.LOCAL", password: "StrongPass123!", role: "admin" });
  expect(response.status).toBe(201);
  expect(response.body.user.role).toBe("learner");
  expect(JSON.stringify(response.body)).not.toContain("StrongPass123!");
  const saved = await User.findOne({ email: "new@test.local" }).select("+password");
  expect(saved.password).not.toBe("StrongPass123!");
  expect(saved.password.startsWith("$2")).toBe(true);
});

test("login returns a JWT and never returns a password", async () => {
  const response = await request(app).post("/api/auth/login")
    .send({ email: "student1@test.local", password: "StudentPass123!" });
  expect(response.status).toBe(200);
  expect(jwt.verify(response.body.token, process.env.JWT_SECRET).userId).toBe(String(student1._id));
  expect(response.body.user.password).toBeUndefined();
  expect((await request(app).post("/api/auth/login").send({ email: "student1@test.local", password: "wrong" })).status).toBe(401);
});

test("invalid and expired JWTs are rejected", async () => {
  const expired = jwt.sign({ userId: String(student1._id) }, process.env.JWT_SECRET, { expiresIn: -1 });
  expect((await request(app).get("/api/books").set("Authorization", "Bearer invalid")).status).toBe(401);
  expect((await request(app).get("/api/books").set("Authorization", `Bearer ${expired}`)).status).toBe(401);
});

test("catalog validation, unique copy code and availability", async () => {
  expect((await request(app).post("/api/books").set("Authorization", token).send({ title: " ", author: "Test" })).status).toBe(400);
  const duplicate = await request(app).post("/api/copies").set("Authorization", token)
    .send({ bookId: String(copy.bookId), inventoryCode: copy.inventoryCode });
  expect(duplicate.status).toBe(409);
  const badReference = await request(app).post("/api/copies").set("Authorization", token)
    .send({ bookId: String(new mongoose.Types.ObjectId()), inventoryCode: "TEST-999" });
  expect(badReference.status).toBe(404);
  await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  const catalog = await request(app).get(`/api/books/${copy.bookId}`).set("Authorization", auth(student2));
  expect(catalog.status).toBe(200);
  expect(catalog.body.copies[0].available).toBe(false);
  expect(JSON.stringify(catalog.body)).not.toContain("borrowerId");
});

test("learner reminder preference does not suppress confirmation and staff cannot change it", async () => {
  expect((await request(app).patch("/api/me/reminders").set("Authorization", token)
    .send({ remindersEnabled: false })).status).toBe(403);
  expect((await request(app).patch("/api/me/reminders").set("Authorization", auth(student1))
    .send({ remindersEnabled: false })).status).toBe(200);
  const issued = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  expect(issued.status).toBe(201);
  expect(issued.body.email.status).toBe("sent");
});

test("return is restricted and statistics reflect the database", async () => {
  const issued = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  const id = issued.body.loan._id;
  expect((await request(app).patch(`/api/loans/${id}/return`).set("Authorization", auth(student1))).status).toBe(403);
  expect((await request(app).get("/api/stats").set("Authorization", auth(student1))).status).toBe(403);
  const stats = await request(app).get("/api/stats").set("Authorization", token);
  expect(stats.body).toMatchObject({ totalCopies: 1, availableCopies: 0, activeLoans: 1, overdueLoans: 0 });
});

test("health, docs, catalog search, book update and copy listing work", async () => {
  expect((await request(app).get("/api/health")).status).toBe(200);
  expect((await request(app).get("/api/docs")).status).toBe(200);
  expect((await request(app).get("/api/test/manager").set("Authorization", token)).status).toBe(200);
  expect((await request(app).get("/api/test/manager").set("Authorization", auth(student1))).status).toBe(403);
  const catalog = await request(app).get("/api/books?search=Node").set("Authorization", auth(student1));
  expect(catalog.status).toBe(200);
  expect(catalog.body).toHaveLength(1);
  expect(catalog.body[0].availableCopies).toBe(1);
  const literalSearch = await request(app).get("/api/books?search=.%2A").set("Authorization", auth(student1));
  expect(literalSearch.body).toHaveLength(0);
  const detail = await request(app).get(`/api/books/${copy.bookId}`).set("Authorization", auth(student1));
  expect(detail.status).toBe(200);
  expect(detail.body.copies[0].inventoryCode).toBe("TEST-001");
  expect((await request(app).post("/api/books").set("Authorization", auth(student1))
    .send({ title: "Forbidden", author: "Author" })).status).toBe(403);
  const created = await request(app).post("/api/books").set("Authorization", token)
    .send({ title: "Another Book", author: "Author" });
  expect(created.status).toBe(201);
  const bookId = created.body.book._id;
  expect((await request(app).put(`/api/books/${bookId}`).set("Authorization", token)
    .send({ description: "Updated" })).body.book.description).toBe("Updated");
  const addedCopy = await request(app).post("/api/copies").set("Authorization", token)
    .send({ bookId, inventoryCode: "TEST-NEW" });
  expect(addedCopy.status).toBe(201);
  const copies = await request(app).get(`/api/copies/book/${bookId}`).set("Authorization", auth(student1));
  expect(copies.status).toBe(200);
  expect(copies.body[0].available).toBe(true);
});

test("loan filters separate active, overdue and returned records", async () => {
  const old = new Date(Date.now() - 4 * 86400000);
  const loan = await Loan.create({ copyId: copy._id, borrowerId: student1._id, issuedBy: manager._id,
    borrowedAt: old, dueAt: new Date(Date.now() - 86400000), durationDays: 3 });
  const get = (role, status) => request(app).get(`/api/loans?status=${status}`).set("Authorization", auth(role));
  expect((await get(manager, "active")).body).toHaveLength(1);
  expect((await get(manager, "overdue")).body).toHaveLength(1);
  expect((await get(manager, "returned")).body).toHaveLength(0);
  expect((await get(student2, "overdue")).body).toHaveLength(0);
  expect((await request(app).get(`/api/loans?borrowerId=${student2._id}`).set("Authorization", token)).body).toHaveLength(0);
  expect((await request(app).patch(`/api/loans/${loan._id}/return`).set("Authorization", token)).status).toBe(200);
  expect((await get(manager, "returned")).body).toHaveLength(1);
  expect((await get(manager, "overdue")).body).toHaveLength(0);
  const catalog = await request(app).get(`/api/books/${copy.bookId}`).set("Authorization", token);
  expect(catalog.body.copies[0].available).toBe(true);
});

test("admin settings and learner preference validate values and roles", async () => {
  expect((await request(app).get("/api/admin/config").set("Authorization", token)).status).toBe(403);
  const config = await request(app).get("/api/admin/config").set("Authorization", auth(admin));
  expect(config.status).toBe(200);
  expect(config.body.loanDurationDays).toBe(14);
  for (const invalid of [{ loanDurationDays: 0 }, { reminderAnticipationDays: 8 },
    { reminderFrequency: "weekly" }, { SMTP_PASSWORD: "wrong-place" }]) {
    expect((await request(app).patch("/api/admin/config").set("Authorization", auth(admin))
      .send(invalid)).status).toBe(400);
  }
  const changed = await request(app).patch("/api/admin/config").set("Authorization", auth(admin))
    .send({ loanDurationDays: 7, reminderAnticipationDays: 3, reminderFrequency: "hourly" });
  expect(changed.status).toBe(200);
  expect(changed.body).toMatchObject({ loanDurationDays: 7, reminderAnticipationDays: 3, reminderFrequency: "hourly" });
  expect((await request(app).get("/api/me/reminders").set("Authorization", auth(student1))).body.remindersEnabled).toBe(true);
  expect((await request(app).patch("/api/me/reminders").set("Authorization", auth(student1))
    .send({ remindersEnabled: "false" })).status).toBe(400);
  expect((await request(app).patch("/api/me/reminders").set("Authorization", auth(student1))
    .send({ remindersEnabled: false })).body.remindersEnabled).toBe(false);
});

test("global email switch skips confirmation without cancelling loan", async () => {
  await request(app).patch("/api/admin/config").set("Authorization", auth(admin)).send({ emailEnabled: false });
  const created = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  expect(created.status).toBe(201);
  expect(created.body.email.status).toBe("skipped");
  expect(await Loan.countDocuments({ returnedAt: null })).toBe(1);
  await request(app).patch(`/api/loans/${created.body.loan._id}/return`).set("Authorization", token);
  await request(app).patch("/api/admin/config").set("Authorization", auth(admin)).send({ emailEnabled: true });
  await request(app).patch("/api/me/reminders").set("Authorization", auth(student1)).send({ remindersEnabled: false });
  const another = await request(app).post("/api/loans").set("Authorization", token)
    .send({ copyId: String(copy._id), borrowerId: String(student1._id) });
  expect(another.status).toBe(201);
  expect(another.body.email.status).toBe("sent");
});

test("admin reminder endpoint saves run summary and respects job switch", async () => {
  const old = new Date(Date.now() - 3 * 86400000);
  await Loan.create({ copyId: copy._id, borrowerId: student1._id, issuedBy: manager._id,
    borrowedAt: old, dueAt: old, durationDays: 1 });
  expect((await request(app).post("/api/admin/jobs/loan-reminders").set("Authorization", token)).status).toBe(403);
  const first = await request(app).post("/api/admin/jobs/loan-reminders").set("Authorization", auth(admin));
  expect(first.status).toBe(200);
  expect(first.body.sent).toBe(1);
  const again = await request(app).post("/api/admin/jobs/loan-reminders").set("Authorization", auth(admin));
  expect(again.body.sent).toBe(0);
  const config = await request(app).get("/api/admin/config").set("Authorization", auth(admin));
  expect(config.body.lastReminderRun.selected).toBe(1);
  await request(app).patch("/api/admin/config").set("Authorization", auth(admin))
    .send({ reminderJobEnabled: false });
  const disabled = await request(app).post("/api/admin/jobs/loan-reminders").set("Authorization", auth(admin));
  expect(disabled.body.reason).toBe("Job disabled");
});
