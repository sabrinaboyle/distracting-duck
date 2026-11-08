importScripts("settings.js", "site-match.js", "meter.js", "session.js", "suggestions.js");

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
    return;
  }
  if (next) {
    syncPanels(next).catch(() => {});
  }
});

async function fetchGeminiSuggestion() {
  const session = await readSession();
  if (!session) {
    return { ok: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(DISTRACTION_DUCK_SETTINGS.suggestionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birdMode: session.birdMode }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: "gemini_http" };
    }
    const payload = await response.json();
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text || payload.source !== "gemini") {
      return { ok: false, reason: "gemini_empty" };
    }
    return { ok: true, text, source: "gemini" };
  } catch {
    return { ok: false, reason: "gemini_network" };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "openSuggestion") {
    const suggestion = distractionDuckSuggestionById(message.id);
    if (!suggestion || !suggestion.url) {
      sendResponse({ ok: false });
      return;
    }
    try {
      const url = new URL(suggestion.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        sendResponse({ ok: false });
        return;
      }
    } catch {
      sendResponse({ ok: false });
      return;
    }
    chrome.tabs.create({ url: suggestion.url }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (message.type === "fetchSuggestion") {
    fetchGeminiSuggestion()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
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
