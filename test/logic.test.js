const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console, URL, Math, Date, Set, Map, Array, Object };
vm.createContext(context);

const root = path.join(__dirname, "..");
for (const file of ["settings.js", "site-match.js", "meter.js", "session.js", "suggestions.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(context.distractionDuckHostPattern("https://example.com/x") === "https://example.com/*", "host pattern");
assert(context.distractionDuckSameSite("https://example.com/a", "https://example.com") === true, "same site");
assert(context.distractionDuckSameSite("https://example.org", "https://example.com") === false, "other site");

const overlap = context.distractionDuckOverlappingOrigins(
  ["https://example.com/work"],
  ["https://example.com/news"],
);
assert(overlap.length === 1 && overlap[0] === "https://example.com", "origin conflict");

const session = context.distractionDuckCreateSession({
  task: "Read chapter 3",
  birdMode: "locked-in-loon",
  distractingSites: ["https://example.com"],
  focusSites: ["https://example.org"],
  workTab: { id: 1, windowId: 1, title: "Work", url: "https://example.org/" },
  now: 1_000,
});
assert(session.birdMode === "locked-in-loon", "mode");
assert(context.distractionDuckClassifyPage("https://example.com/x", session) === "distract", "classify distract");
assert(context.distractionDuckClassifyPage("https://example.org/", session) === "focus", "classify focus");
assert(context.distractionDuckShouldShowPanel(session, "https://example.org/") === true, "loon on focus");
assert(context.distractionDuckShouldShowPanel({ ...session, birdMode: "distracted-duck" }, "https://example.org/") === false, "duck hides on focus");
assert(context.distractionDuckShouldShowPanel({ ...session, paused: true }, "https://example.com") === false, "paused hides");

const old = context.distractionDuckNormalizeSession({
  active: true,
  task: "Old task",
  distraction: "https://example.com/old",
  startedAt: 5,
  workTab: { id: 9 },
});
assert(old.distractingSites[0] === "https://example.com", "migrate single site");

const moving = context.distractionDuckCommitMeter(
  { ...session, meter: { value: 50, updatedAt: 0, phase: "focus" }, paused: false },
  "focus",
  10_000,
);
assert(moving.value > 50, "focus time raises meter");

const drifting = context.distractionDuckCommitMeter(
  { ...session, birdMode: "malicious-mallard", meter: { value: 50, updatedAt: 0, phase: "distract" }, paused: false },
  "distract",
  10_000,
);
const slower = context.distractionDuckCommitMeter(
  { ...session, birdMode: "distracted-duck", meter: { value: 50, updatedAt: 0, phase: "distract" }, paused: false },
  "distract",
  10_000,
);
assert(drifting.value < slower.value, "mallard distracts faster");

const paused = context.distractionDuckProjectMeter(
  { ...session, paused: true, meter: { value: 40, updatedAt: 0, phase: "focus" } },
  20_000,
);
assert(paused.value === 40, "pause holds the meter");

const first = context.distractionDuckSuggestionList("malicious-mallard", "distract")[0];
const next = context.distractionDuckNextSuggestion("malicious-mallard", "distract", first.id);
assert(next && next.id !== first.id, "next suggestion");
assert(context.DISTRACTION_DUCK_SUGGESTION_SOURCE === "prewritten", "prewritten source");
assert(context.distractionDuckSuggestionById(first.id).text === first.text, "lookup suggestion");

const duckLine = context.distractionDuckSuggestionList("distracted-duck", "distract")[0];
const loonLine = context.distractionDuckSuggestionForMode("locked-in-loon", "distract", duckLine.id);
assert(loonLine.id !== duckLine.id, "mode switch drops other-mode suggestion ids");
const cycled = context.distractionDuckNextSuggestion("locked-in-loon", "distract", loonLine.id);
assert(cycled.id !== loonLine.id, "cycle suggestion inside one mode");

console.log("logic tests passed");
