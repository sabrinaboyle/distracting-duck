import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const KEY = process.env.GEMINI_API_KEY || "";

const MODE_PROMPTS = {
  "distracted-duck":
    "You are Distracted Duck, a playful Chrome-extension bird. Write one short suggestion (one or two sentences) that offers a harmless, silly detour and then a nudge back to work.",
  "malicious-mallard":
    "You are Malicious Mallard, a mischievous but not cruel Chrome-extension bird. Write one short cheeky suggestion (one or two sentences). Do not shame, insult, or attack the reader.",
  "locked-in-loon":
    "You are Locked-in Loon, a gentle Chrome-extension bird. Write one short encouraging or lightly reminding suggestion (one or two sentences). No guilt.",
};

function loadDotEnv(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    const name = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (name && process.env[name] == null) {
      process.env[name] = value;
    }
  }
}

export function promptForMode(birdMode) {
  const voice = MODE_PROMPTS[birdMode];
  if (!voice) {
    return null;
  }
  return [
    voice,
    "Rules: reply with only the suggestion text. No title, no quotes, no list, no website URLs, no user task, no browsing history, no page content.",
  ].join(" ");
}

export function sanitizeSuggestion(text) {
  if (typeof text !== "string") {
    return "";
  }
  let cleaned = text.replace(/\s+/g, " ").trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.length > 220) {
    cleaned = `${cleaned.slice(0, 217).trim()}…`;
  }
  return cleaned;
}

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "null",
  });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 2000) {
      throw new Error("too large");
    }
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function generateSuggestion(birdMode) {
  const prompt = promptForMode(birdMode);
  const apiKey = process.env.GEMINI_API_KEY || KEY;
  if (!prompt) {
    return { status: 400, body: { error: "unknown_mode" } };
  }
  if (!apiKey) {
    return { status: 503, body: { error: "gemini_unconfigured" } };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const apiResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 80,
      },
    }),
  });

  if (!apiResponse.ok) {
    return { status: 502, body: { error: "gemini_unavailable" } };
  }

  const data = await apiResponse.json();
  const text = sanitizeSuggestion(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  if (!text) {
    return { status: 502, body: { error: "gemini_empty" } };
  }
  return { status: 200, body: { text, source: "gemini" } };
}

export function createServer() {
  return http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "null",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Allow-Headers": "content-type",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, {
        ok: true,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY || KEY),
      });
      return;
    }

    if (request.method === "POST" && request.url === "/suggestion") {
      let body;
      try {
        body = await readBody(request);
      } catch {
        json(response, 400, { error: "invalid_json" });
        return;
      }
      const birdMode = typeof body.birdMode === "string" ? body.birdMode : "";
      try {
        const result = await generateSuggestion(birdMode);
        json(response, result.status, result.body);
      } catch {
        json(response, 502, { error: "gemini_unavailable" });
      }
      return;
    }

    json(response, 404, { error: "not_found" });
  });
}

const startedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (startedDirectly) {
  createServer().listen(PORT, "127.0.0.1", () => {
    console.log(`Distraction Duck suggestion server on http://127.0.0.1:${PORT}`);
    console.log(`Gemini configured: ${Boolean(process.env.GEMINI_API_KEY || KEY)}`);
  });
}
