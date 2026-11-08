import assert from "node:assert/strict";
import { createServer, promptForMode, sanitizeSuggestion } from "../server/gemini.mjs";

assert.match(promptForMode("distracted-duck"), /Distracted Duck/);
assert.match(promptForMode("malicious-mallard"), /not shame/);
assert.match(promptForMode("locked-in-loon"), /gentle/);
assert.equal(promptForMode("not-a-bird"), null);
assert.match(promptForMode("distracted-duck"), /No title, no quotes/);

assert.equal(sanitizeSuggestion('  "Hello there."  '), "Hello there.");
assert.ok(sanitizeSuggestion("a".repeat(300)).length <= 220);

const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
assert.equal(health.ok, true);
assert.equal(health.geminiConfigured, false);

const missingMode = await fetch(`http://127.0.0.1:${port}/suggestion`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ birdMode: "not-a-bird" }),
});
assert.equal(missingMode.status, 400);

const unconfigured = await fetch(`http://127.0.0.1:${port}/suggestion`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ birdMode: "distracted-duck" }),
});
assert.equal(unconfigured.status, 503);
const unconfiguredBody = await unconfigured.json();
assert.equal(unconfiguredBody.error, "gemini_unconfigured");
assert.equal(JSON.stringify(unconfiguredBody).includes("key"), false);

server.close();
console.log("server tests passed");
