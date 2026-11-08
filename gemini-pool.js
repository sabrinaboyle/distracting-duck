var DISTRACTION_DUCK_GEMINI_POOL_KEY = "distractionDuckGeminiPool";

function distractionDuckEmptyGeminiPool() {
  var pool = {};
  DISTRACTION_DUCK_MODES.forEach(function (mode) {
    pool[mode.id] = [];
  });
  return pool;
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
      var text = typeof list[i] === "string" ? list[i].replace(/\s+/g, " ").trim() : "";
      if (!text || seen[text]) {
        continue;
      }
      seen[text] = true;
      pool[mode].push(text);
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
    return { text: "", pool: next };
  }
  var text = next[birdMode].shift() || "";
  return { text: text, pool: next };
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
    seen[item] = true;
  });
  (Array.isArray(texts) ? texts : []).forEach(function (item) {
    var text = typeof item === "string" ? item.replace(/\s+/g, " ").trim() : "";
    if (!text || seen[text] || existing.length >= cap) {
      return;
    }
    seen[text] = true;
    existing.push(text);
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
