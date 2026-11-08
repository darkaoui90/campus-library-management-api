const errors = {
  400: { description: "Invalid input" }, 401: { description: "Missing or invalid JWT" },
  403: { description: "Insufficient role" }, 404: { description: "Resource not found" },
  409: { description: "Conflict" }, 500: { description: "Unexpected server error" }
};
const json = (properties, required = []) => ({ required: true, content: { "application/json": {
  schema: { type: "object", properties, required }
} } });
const string = { type: "string" };
const boolean = { type: "boolean" };
const integer = { type: "integer" };
const bearer = [{ bearerAuth: [] }];
const id = name => ({ in: "path", name, required: true, schema: string });
const query = name => ({ in: "query", name, schema: string });
const endpoint = (summary, role, success, body, parameters) => ({ summary, description: `Required role: ${role}.`, security: role === "public" ? [] : bearer,
  ...(body ? { requestBody: body } : {}), ...(parameters ? { parameters } : {}),
  responses: { [success]: { description: "Success" }, ...errors } });

module.exports = {
  openapi: "3.0.3",
  info: { title: "Campus Library Management API", version: "1.0.0", description: "All dates are stored in UTC. Reminder calendar days use Africa/Casablanca." },
  servers: [{ url: "/" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  paths: {
    "/api/health": { get: endpoint("Health check", "public", 200) },
    "/api/docs": { get: endpoint("OpenAPI documentation UI", "public", 200) },
    "/api/auth/register": { post: endpoint("Register learner", "public", 201, json({ name: string, email: string, password: string }, ["name", "email", "password"])) },
    "/api/auth/login": { post: endpoint("Login", "public", 200, json({ email: string, password: string }, ["email", "password"])) },
    "/api/books": {
      get: endpoint("List/search books with copies and availability", "authenticated", 200, null, [query("search")]),
      post: endpoint("Create book", "manager or admin", 201, json({ title: string, author: string, description: string }, ["title", "author"]))
    },
    "/api/books/{id}": {
      get: endpoint("Get book and copies", "authenticated", 200, null, [id("id")]),
      put: endpoint("Update book", "manager or admin", 200, json({ title: string, author: string, description: string }), [id("id")])
    },
    "/api/copies": { post: endpoint("Add physical copy", "manager or admin", 201, json({ bookId: string, inventoryCode: string }, ["bookId", "inventoryCode"])) },
    "/api/copies/book/{bookId}": { get: endpoint("List copies and availability", "authenticated", 200, null, [id("bookId")]) },
    "/api/loans": {
      get: endpoint("List own loans, or all loans for staff", "authenticated", 200, null, [query("borrowerId"), { ...query("status"), schema: { type: "string", enum: ["active", "overdue", "returned"] } }]),
      post: endpoint("Issue loan; dates come from server", "manager or admin", 201, json({ copyId: string, borrowerId: string }, ["copyId", "borrowerId"]))
    },
    "/api/loans/{id}/return": { patch: endpoint("Register return (idempotent)", "manager or admin", 200, null, [id("id")]) },
    "/api/me/reminders": {
      get: endpoint("Get own reminder preference", "learner", 200),
      patch: endpoint("Set own reminder preference", "learner", 200, json({ remindersEnabled: boolean }, ["remindersEnabled"]))
    },
    "/api/admin/config": {
      get: endpoint("Get persistent configuration", "admin", 200),
      patch: endpoint("Update configuration", "admin", 200, json({ loanDurationDays: integer, emailEnabled: boolean,
        reminderJobEnabled: boolean, reminderFrequency: { type: "string", enum: ["hourly", "daily"] }, reminderAnticipationDays: integer }))
    },
    "/api/admin/jobs/loan-reminders": { post: endpoint("Run reminder job", "admin", 200) },
    "/api/stats": { get: endpoint("Copy and loan counts", "manager or admin", 200) },
    "/api/test/manager": { get: endpoint("RBAC diagnostic", "manager or admin", 200) }
  }
};
