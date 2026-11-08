const fs = require("fs");
const spec = require("../docs/openapi");
const items = [];
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    const url = "{{baseUrl}}" + path.replace(/\{([^}]+)\}/g, "{{$1}}");
    const headers = operation.security.length ? [{ key: "Authorization", value: "Bearer {{token}}" }] : [];
    let body;
    if (operation.requestBody) {
      headers.push({ key: "Content-Type", value: "application/json" });
      const properties = operation.requestBody.content["application/json"].schema.properties;
      body = { mode: "raw", raw: JSON.stringify(Object.fromEntries(Object.keys(properties).map(key => [key, ""])), null, 2) };
    }
    items.push({ name: `${method.toUpperCase()} ${path} - ${operation.description}`, request: {
      method: method.toUpperCase(), header: headers, url, ...(body ? { body } : {})
    }, response: [] });
  }
}
const collection = { info: { name: "Campus Library API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  variable: [{ key: "baseUrl", value: "http://localhost:5000" }, { key: "token", value: "" },
    { key: "id", value: "" }, { key: "bookId", value: "" }], item: items };
fs.writeFileSync("docs/campus-library.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");
