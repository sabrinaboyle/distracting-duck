var DISTRACTION_DUCK_GEMINI_POOL_KEY = "distractionDuckGeminiPool";

function distractionDuckEmptyGeminiPool() {
  var pool = {};
  DISTRACTION_DUCK_MODES.forEach(function (mode) {
    pool[mode.id] = [];
  });
  return pool;
}

function distractionDuckSafeHttpUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  try {
    var url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

function distractionDuckSafeHttpUrlFromText(text) {
  if (typeof text !== "string") {
    return "";
  }
  var match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) {
    return "";
  }
  return distractionDuckSafeHttpUrl(match[0].replace(/[.,;:!?)]+$/, ""));
}

function distractionDuckGeminiPoolItem(raw) {
  var text = "";
  var url = "";
  if (typeof raw === "string") {
    text = raw.replace(/\s+/g, " ").trim();
    url = distractionDuckSafeHttpUrlFromText(text);
  } else if (raw && typeof raw === "object" && typeof raw.text === "string") {
    text = raw.text.replace(/\s+/g, " ").trim();
    url = distractionDuckSafeHttpUrl(raw.url) || distractionDuckSafeHttpUrlFromText(text);
  }
  if (!text) {
    return null;
  }
  return { text: text, url: url };
}

function distractionDuckNormalizeGeminiPool(raw) {
  var pool = distractionDuckEmptyGeminiPool();
  if (!raw || typeof raw !== "object") {
    return pool;
  }
  Object.keys(pool).forEach(function (mode) {
    var list = Array.isArray(raw[mode]) ? raw[mode] : [];
    var seen = {};
    pool[mode] = [];
    for (var i = 0; i < list.length; i += 1) {
      var item = distractionDuckGeminiPoolItem(list[i]);
      if (!item || seen[item.text]) {
        continue;
      }
      seen[item.text] = true;
      pool[mode].push(item);
      if (pool[mode].length >= 8) {
        break;
      }
    }
  });
  return pool;
}

function distractionDuckTakeGeminiPooled(pool, birdMode) {
  var next = distractionDuckNormalizeGeminiPool(pool);
  if (!Object.prototype.hasOwnProperty.call(next, birdMode)) {
    return { text: "", url: "", pool: next };
  }
  var item = next[birdMode].shift() || { text: "", url: "" };
  return { text: item.text || "", url: item.url || "", pool: next };
}

function distractionDuckAddGeminiPooled(pool, birdMode, texts, maxSize) {
  var next = distractionDuckNormalizeGeminiPool(pool);
  if (!Object.prototype.hasOwnProperty.call(next, birdMode)) {
    return next;
  }
  var cap = Math.max(1, Number(maxSize) || 3);
  var existing = next[birdMode];
  var seen = {};
  existing.forEach(function (item) {
    seen[item.text] = true;
  });
  (Array.isArray(texts) ? texts : []).forEach(function (raw) {
    var item = distractionDuckGeminiPoolItem(raw);
    if (!item || seen[item.text] || existing.length >= cap) {
      return;
    }
    seen[item.text] = true;
    existing.push(item);
  });
  return next;
}

function distractionDuckGeminiPoolNeedsFill(pool, birdMode, size) {
  var next = distractionDuckNormalizeGeminiPool(pool);
  if (!Object.prototype.hasOwnProperty.call(next, birdMode)) {
    return false;
  }
  return next[birdMode].length < Math.max(1, Number(size) || 3);
}
