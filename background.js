importScripts("site-match.js");

const SESSION_KEY = "focusSession";

function activeSession(session) {
  return Boolean(
    session &&
      session.active === true &&
      typeof session.distraction === "string" &&
      session.workTab &&
      typeof session.workTab.id === "number",
  );
}

async function readSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return activeSession(stored[SESSION_KEY]) ? stored[SESSION_KEY] : null;
}

async function injectPanel(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["site-match.js", "duck-panel.js"],
  });
}

async function maybeShowPanel(tabId, url) {
  if (!tabId || !url) {
    return;
  }
  const session = await readSession();
  if (!session || !distractionDuckSameSite(url, session.distraction)) {
    return;
  }
  try {
    await injectPanel(tabId);
  } catch {
    // The tab closed, or Chrome has not granted this site.
  }
}

async function showOnMatchingTabs(session) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && distractionDuckSameSite(tab.url, session.distraction))
      .map((tab) => injectPanel(tab.id).catch(() => {})),
  );
}

async function hideOnMatchingTabs(session) {
  if (!session || typeof session.distraction !== "string") {
    return;
  }
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && distractionDuckSameSite(tab.url, session.distraction))
      .map((tab) =>
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id, allFrames: false },
            func: () => {
              document.getElementById("distraction-duck-panel-host")?.remove();
              if (window.distractionDuckPanel) {
                window.distractionDuckPanel.status = "hidden";
                window.distractionDuckPanel.startedAt = null;
              }
            },
          })
          .catch(() => {}),
      ),
  );
}

async function releaseSite(session) {
  if (!session || typeof session.distraction !== "string") {
    return;
  }
  try {
    await chrome.permissions.remove({
      origins: [distractionDuckHostPattern(session.distraction)],
    });
  } catch {
    // The grant is already gone.
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  maybeShowPanel(tabId, changeInfo.url || tab.url);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs
    .get(activeInfo.tabId)
    .then((tab) => maybeShowPanel(tab.id, tab.url))
    .catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, SESSION_KEY)) {
    return;
  }
  const previous = changes[SESSION_KEY].oldValue;
  const next = changes[SESSION_KEY].newValue;
  if (activeSession(previous)) {
    const nextSite = activeSession(next) ? next.distraction : "";
    if (previous.distraction !== nextSite) {
      hideOnMatchingTabs(previous).finally(() => releaseSite(previous));
    }
  }
  if (activeSession(next)) {
    showOnMatchingTabs(next);
  }
});
