import assert from "node:assert/strict";
import { createServer, parseSuggestionLines, promptForMode, sanitizeSuggestion } from "../server/gemini.mjs";

assert.match(promptForMode("distracted-duck"), /Distracted Duck/);
assert.match(promptForMode("malicious-mallard"), /not shame/);
assert.match(promptForMode("locked-in-loon"), /gentle/);
assert.equal(promptForMode("not-a-bird"), null);
assert.match(promptForMode("distracted-duck"), /No title, no quotes/);
assert.match(promptForMode("distracted-duck"), /https URL/);
assert.match(promptForMode("distracted-duck", 3), /Write 3 short suggestions/);
assert.deepEqual(
  parseSuggestionLines("1. Stretch, then return.\n- Doodle a duck, then get back.\n\n\"Open a window, then work.\"", 3),
  [
    { text: "Stretch, then return.", url: "" },
    { text: "Doodle a duck, then get back.", url: "" },
    { text: "Open a window, then work.", url: "" },
  ],
);
assert.equal(
  parseSuggestionLines("Go peek at cats https://www.youtube.com/watch?v=dQw4w9WgXcQ then return.", 1)[0].url,
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
);

assert.equal(sanitizeSuggestion('  "Hello there."  '), "Hello there.");
assert.ok(sanitizeSuggestion("a".repeat(500)).length <= 400);
assert.match(
  sanitizeSuggestion(`${"a".repeat(360)} https://en.wikipedia.org/wiki/Rubber_duck`),
  /https:\/\/en\.wikipedia\.org\/wiki\/Rubber_duck/,
);

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
