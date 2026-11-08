importScripts("settings.js", "site-match.js", "meter.js", "session.js", "suggestions.js", "gemini-pool.js");

let browserFocused = true;

async function readSession() {
  const stored = await chrome.storage.local.get(DISTRACTION_DUCK_SESSION_KEY);
  return distractionDuckNormalizeSession(stored[DISTRACTION_DUCK_SESSION_KEY]);
}

async function writeSession(session) {
  await chrome.storage.local.set({ [DISTRACTION_DUCK_SESSION_KEY]: session });
}

async function injectPanel(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["settings.js", "site-match.js", "meter.js", "session.js", "suggestions.js", "duck-panel.js"],
  });
}

async function hidePanel(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: () => {
      document.getElementById("distraction-duck-panel-host")?.remove();
      if (window.distractionDuckPanel) {
        window.distractionDuckPanel.status = "hidden";
        window.distractionDuckPanel.startedAt = null;
      }
    },
  });
}

function matchingTabs(session, tabs) {
  return tabs.filter((tab) => {
    if (!tab.id || !tab.url) {
      return false;
    }
    return (
      distractionDuckMatchesList(tab.url, session.distractingSites) ||
      distractionDuckMatchesList(tab.url, session.focusSites)
    );
  });
}

async function syncPanels(session) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    matchingTabs(session || { distractingSites: [], focusSites: [] }, tabs).map(async (tab) => {
      try {
        if (session && distractionDuckShouldShowPanel(session, tab.url)) {
          await injectPanel(tab.id);
        } else {
          await hidePanel(tab.id);
        }
      } catch {
        // The tab closed, or Chrome has not granted this site.
      }
    }),
  );
}

async function releaseSites(session) {
  const origins = distractionDuckHostPatterns(session);
  if (!origins.length) {
    return;
  }
  try {
    await chrome.permissions.remove({ origins });
  } catch {
    // The grant is already gone.
  }
}

async function focusedTab() {
  if (!browserFocused) {
    return null;
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function currentPhase(session) {
  if (!session || session.paused) {
    return "pause";
  }
  try {
    const idleState = await chrome.idle.queryState(DISTRACTION_DUCK_SETTINGS.idleSeconds);
    if (idleState !== "active") {
      return "pause";
    }
  } catch {
    // Idle state is unavailable; window focus still pauses the meter.
  }
  const tab = await focusedTab();
  if (!tab || !tab.url) {
    return "pause";
  }
  const kind = distractionDuckClassifyPage(tab.url, session);
  if (kind === "focus" || kind === "distract") {
    return kind;
  }
  return "pause";
}

async function refreshMeterAndPanels() {
  const session = await readSession();
  if (!session) {
    return;
  }
  const phase = await currentPhase(session);
  session.meter = distractionDuckCommitMeter(session, phase, Date.now());
  await writeSession(session);
  await syncPanels(session);
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status !== "complete" && !changeInfo.url) {
    return;
  }
  refreshMeterAndPanels().catch(() => {});
});

chrome.tabs.onActivated.addListener(() => {
  refreshMeterAndPanels().catch(() => {});
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  browserFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
  refreshMeterAndPanels().catch(() => {});
});

if (chrome.idle && chrome.idle.onStateChanged) {
  chrome.idle.onStateChanged.addListener(() => {
    refreshMeterAndPanels().catch(() => {});
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, DISTRACTION_DUCK_SESSION_KEY)) {
    return;
  }
  const previous = distractionDuckNormalizeSession(changes[DISTRACTION_DUCK_SESSION_KEY].oldValue);
  const next = distractionDuckNormalizeSession(changes[DISTRACTION_DUCK_SESSION_KEY].newValue);
  if (previous && !next) {
    syncPanels(previous).finally(() => releaseSites(previous));
    return;
  }
  if (!previous && next) {
    refreshMeterAndPanels().catch(() => {});
    fillGeminiPoolSoon(next.birdMode);
    return;
  }
  if (next) {
    if (previous && previous.birdMode !== next.birdMode) {
      fillGeminiPoolSoon(next.birdMode);
    }
    syncPanels(next).catch(() => {});
  }
});

const geminiInflight = {};
let geminiPoolGate = Promise.resolve();

function withGeminiPoolGate(work) {
  const run = geminiPoolGate.then(work, work);
  geminiPoolGate = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function readGeminiPool() {
  const stored = await chrome.storage.local.get(DISTRACTION_DUCK_GEMINI_POOL_KEY);
  return distractionDuckNormalizeGeminiPool(stored[DISTRACTION_DUCK_GEMINI_POOL_KEY]);
}

async function writeGeminiPool(pool) {
  await chrome.storage.local.set({
    [DISTRACTION_DUCK_GEMINI_POOL_KEY]: distractionDuckNormalizeGeminiPool(pool),
  });
}

function suggestionItemsFromPayload(payload) {
  if (!payload || payload.source !== "gemini") {
    return [];
  }
  const fromSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  if (fromSuggestions.length) {
    return fromSuggestions;
  }
  const fromList = Array.isArray(payload.texts)
    ? payload.texts.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (fromList.length) {
    return fromList;
  }
  const one = typeof payload.text === "string" ? payload.text.trim() : "";
  return one ? [one] : [];
}

async function fetchGeminiSuggestions(birdMode, count) {
  const n = Math.min(5, Math.max(1, Number(count) || 1));
  if (geminiInflight[birdMode]) {
    return geminiInflight[birdMode];
  }
  geminiInflight[birdMode] = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DISTRACTION_DUCK_SETTINGS.geminiTimeoutMs);
    try {
      const response = await fetch(DISTRACTION_DUCK_SETTINGS.suggestionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birdMode, count: n }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { ok: false, reason: "gemini_http" };
      }
      const payload = await response.json();
      const items = suggestionItemsFromPayload(payload);
      if (!items.length) {
        return { ok: false, reason: "gemini_empty" };
      }
      return { ok: true, items };
    } catch {
      return { ok: false, reason: "gemini_network" };
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    delete geminiInflight[birdMode];
  });
  return geminiInflight[birdMode];
}

async function popGeminiPooled(birdMode) {
  return withGeminiPoolGate(async () => {
    const taken = distractionDuckTakeGeminiPooled(await readGeminiPool(), birdMode);
    await writeGeminiPool(taken.pool);
    return taken;
  });
}

async function fillGeminiPoolToSize(birdMode) {
  if (!birdMode) {
    return;
  }
  const pool = await readGeminiPool();
  if (!distractionDuckGeminiPoolNeedsFill(pool, birdMode, DISTRACTION_DUCK_SETTINGS.geminiPoolSize)) {
    return;
  }
  const need = DISTRACTION_DUCK_SETTINGS.geminiPoolSize - pool[birdMode].length;
  const fetched = await fetchGeminiSuggestions(birdMode, Math.max(need, DISTRACTION_DUCK_SETTINGS.geminiPoolSize));
  if (!fetched.ok) {
    return;
  }
  await withGeminiPoolGate(async () => {
    const latest = await readGeminiPool();
    await writeGeminiPool(
      distractionDuckAddGeminiPooled(
        latest,
        birdMode,
        fetched.items,
        DISTRACTION_DUCK_SETTINGS.geminiPoolSize,
      ),
    );
  });
}

function fillGeminiPoolSoon(birdMode) {
  fillGeminiPoolToSize(birdMode).catch(() => {});
}

async function takeGeminiSuggestion() {
  const session = await readSession();
  if (!session) {
    return { ok: false, reason: "no_session" };
  }
  const birdMode = session.birdMode;
  let taken = await popGeminiPooled(birdMode);
  if (taken.text) {
    fillGeminiPoolSoon(birdMode);
    return { ok: true, text: taken.text, url: taken.url, source: "gemini" };
  }
  await fillGeminiPoolToSize(birdMode);
  taken = await popGeminiPooled(birdMode);
  if (taken.text) {
    fillGeminiPoolSoon(birdMode);
    return { ok: true, text: taken.text, url: taken.url, source: "gemini" };
  }
  return { ok: false, reason: "gemini_empty" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "openSuggestion") {
    const fromMessage = distractionDuckSafeHttpUrl(message.url);
    const suggestion = distractionDuckSuggestionById(message.id);
    const target = fromMessage || (suggestion && suggestion.url) || "";
    if (!target) {
      sendResponse({ ok: false });
      return;
    }
    chrome.tabs.create({ url: target }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (message.type === "fetchSuggestion") {
    takeGeminiSuggestion()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === "warmGeminiPool") {
    const sessionBirdMode = typeof message.birdMode === "string" ? message.birdMode : "";
    fillGeminiPoolSoon(sessionBirdMode);
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "pauseSession") {
    readSession().then(async (session) => {
      if (!session) {
        sendResponse({ ok: false });
        return;
      }
      session.paused = true;
      session.meter = distractionDuckCommitMeter(session, "pause", Date.now());
      await writeSession(session);
      sendResponse({ ok: true });
    });
    return true;
  }
});
