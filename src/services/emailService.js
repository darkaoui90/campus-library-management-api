const nodemailer = require("nodemailer");
const { getConfig } = require("./configService");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function sendLoanEmail(loan, kind) {
  const config = await getConfig();
  if (!config.emailEnabled) {
    console.log(`Email skipped: globally disabled (${kind}, loan ${loan._id})`);
    return { status: "skipped", reason: "Email disabled" };
  }
  const borrower = loan.borrowerId;
  const copy = loan.copyId;
  const title = copy.bookId.title;
  const subject = kind === "reminder" ? "Library loan reminder" : "Library borrowing confirmation";
  const html = `<h1>${escapeHtml(subject)}</h1><p>Hello ${escapeHtml(borrower.name)},</p>` +
    `<p>Book: ${escapeHtml(title)}<br>Inventory code: ${escapeHtml(copy.inventoryCode)}<br>` +
    `Due: ${escapeHtml(loan.dueAt.toLocaleString("en-GB", { timeZone: "Africa/Casablanca" }))} (Africa/Casablanca)</p>`;
  if ((process.env.EMAIL_MODE || "log") === "log") {
    console.log(`EMAIL LOG to ${borrower.email}: ${subject} | ${title} | ${copy.inventoryCode} | ${loan.dueAt.toISOString()}`);
    return { status: "sent" };
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({ from: process.env.SMTP_FROM, to: borrower.email, subject, html });
  return { status: "sent" };
}

module.exports = { sendLoanEmail };
