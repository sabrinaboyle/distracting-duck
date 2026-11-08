const PANEL_HOST_ID = "distraction-duck-panel-host";

if (window === window.top) {
  if (!window.distractionDuckPanel) {
    window.distractionDuckPanel = {
      startedAt: null,
      status: "idle",
      suggestionId: null,
      chain: Promise.resolve(),
    };
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, DISTRACTION_DUCK_SESSION_KEY)) {
        return;
      }
      schedulePanelSync();
    });
  }
  schedulePanelSync();
}

function schedulePanelSync() {
  const state = window.distractionDuckPanel;
  if (!state) {
    return;
  }
  state.chain = state.chain.then(syncPanel, syncPanel);
}

async function readPanelSession() {
  try {
    const stored = await chrome.storage.local.get(DISTRACTION_DUCK_SESSION_KEY);
    return distractionDuckNormalizeSession(stored[DISTRACTION_DUCK_SESSION_KEY]);
  } catch {
    return null;
  }
}

async function syncPanel() {
  const state = window.distractionDuckPanel;
  if (!state) {
    return;
  }
  let session;
  try {
    session = await readPanelSession();
  } catch {
    return;
  }
  const startedAt = session ? session.startedAt : null;
  const shouldShow = distractionDuckShouldShowPanel(session, location.href);
  if (!shouldShow) {
    removePanelHost();
    state.status = "hidden";
    state.startedAt = null;
    state.suggestionId = null;
    return;
  }
  if (state.status === "dismissed" && state.startedAt === startedAt) {
    return;
  }
  if (state.status === "shown" && state.startedAt === startedAt && document.getElementById(PANEL_HOST_ID)) {
    updateOpenPanel(session);
    return;
  }
  removePanelHost();
  state.status = "shown";
  state.startedAt = startedAt;
  const kind = distractionDuckClassifyPage(location.href, session);
  const first = distractionDuckSuggestionList(session.birdMode, kind === "focus" ? "focus" : "distract")[0];
  state.suggestionId = first ? first.id : null;
  mountPanel(session, startedAt);
}

function removePanelHost() {
  document.getElementById(PANEL_HOST_ID)?.remove();
}

function dismissPanel(startedAt) {
  const state = window.distractionDuckPanel;
  state.status = "dismissed";
  state.startedAt = startedAt;
  removePanelHost();
}

function panelElements() {
  const host = document.getElementById(PANEL_HOST_ID);
  return host && host.shadowRoot ? host.shadowRoot : null;
}

function suggestionFor(session) {
  const state = window.distractionDuckPanel;
  const kind = distractionDuckClassifyPage(location.href, session) === "focus" ? "focus" : "distract";
  const suggestion = distractionDuckSuggestionForMode(session.birdMode, kind, state.suggestionId);
  if (suggestion) {
    state.suggestionId = suggestion.id;
  }
  return suggestion;
}

function updateOpenPanel(session) {
  const root = panelElements();
  if (!root) {
    return;
  }
  const mode = distractionDuckModeById(session.birdMode);
  const suggestion = suggestionFor(session);
  root.querySelector("#distraction-duck-title").textContent = mode.name;
  root.querySelector("#distraction-duck-message").textContent = suggestion.text;
  const openButton = root.querySelector("#distraction-duck-open");
  if (suggestion.url) {
    openButton.hidden = false;
    openButton.dataset.suggestionId = suggestion.id;
  } else {
    openButton.hidden = true;
    delete openButton.dataset.suggestionId;
  }
  const projected = distractionDuckProjectMeter(session, Date.now());
  const fill = root.querySelector("#distraction-duck-meter-fill");
  const track = root.querySelector("#distraction-duck-meter");
  fill.style.width = `${Math.round(projected.value)}%`;
  track.setAttribute("aria-valuenow", String(Math.round(projected.value)));
  track.setAttribute("aria-valuetext", distractionDuckMeterLabel(projected.value));
}

function mountPanel(session, startedAt) {
  if (document.getElementById(PANEL_HOST_ID)) {
    updateOpenPanel(session);
    return;
  }

  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483646;
      right: 1rem;
      bottom: 1rem;
      display: block;
      width: min(20rem, calc(100vw - 2rem));
      color-scheme: light;
    }
    section {
      box-sizing: border-box;
      max-height: calc(100vh - 2rem);
      overflow: auto;
      padding: 0.9rem 1rem 1rem;
      border: 1px solid #78716c;
      border-top: 0.375rem solid #b45309;
      border-radius: 0.5rem;
      background: #f6f3ec;
      color: #1c1917;
      font: 1rem/1.45 "Segoe UI", system-ui, sans-serif;
      box-shadow: 0 0.5rem 1.5rem rgb(28 25 23 / 20%);
    }
    h2 {
      margin: 0 0 0.4rem;
      font-size: 1.05rem;
      line-height: 1.2;
      font-weight: 700;
    }
    p {
      margin: 0 0 0.7rem;
    }
    .meter-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .meter-track {
      height: 0.7rem;
      margin: 0.25rem 0 0.7rem;
      border: 1px solid #78716c;
      border-radius: 999px;
      background: #e7e5e4;
      overflow: hidden;
    }
    .meter-fill {
      height: 100%;
      width: 50%;
      background: linear-gradient(90deg, #b45309, #14352e);
    }
    .hint {
      color: #44403c;
      font-size: 0.8rem;
    }
    button {
      width: 100%;
      min-height: 2.5rem;
      margin: 0 0 0.4rem;
      padding: 0.45rem 0.7rem;
      border: 2px solid #14352e;
      border-radius: 0.5rem;
      background: #14352e;
      color: #ffffff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary {
      background: #ffffff;
      color: #14352e;
    }
    button:focus-visible {
      outline: 3px solid #1d4ed8;
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .meter-fill { transition: width 0.35s linear; }
    }
    @media (prefers-reduced-motion: reduce) {
      .meter-fill { transition: none; }
    }
  `;

  const panel = document.createElement("section");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", "distraction-duck-title");

  const title = document.createElement("h2");
  title.id = "distraction-duck-title";

  const message = document.createElement("p");
  message.id = "distraction-duck-message";
  message.setAttribute("aria-live", "polite");

  const meterLabels = document.createElement("div");
  meterLabels.className = "meter-labels";
  meterLabels.innerHTML = "<span>Distracted</span><span>Locked in</span>";

  const meter = document.createElement("div");
  meter.id = "distraction-duck-meter";
  meter.className = "meter-track";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-label", "Focus meter");
  const fill = document.createElement("div");
  fill.id = "distraction-duck-meter-fill";
  fill.className = "meter-fill";
  meter.append(fill);

  const caption = document.createElement("p");
  caption.className = "hint";
  caption.textContent = "Playful time on your selected sites, not a measure of attention.";

  const another = document.createElement("button");
  another.type = "button";
  another.className = "secondary";
  another.textContent = "Another suggestion";
  another.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const current = await readPanelSession();
    if (!current) {
      return;
    }
    const kind = distractionDuckClassifyPage(location.href, current) === "focus" ? "focus" : "distract";
    const next = distractionDuckNextSuggestion(current.birdMode, kind, window.distractionDuckPanel.suggestionId);
    window.distractionDuckPanel.suggestionId = next.id;
    updateOpenPanel(current);
  });

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.id = "distraction-duck-open";
  openButton.className = "secondary";
  openButton.textContent = "Open this page";
  openButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const id = openButton.dataset.suggestionId;
    if (!id) {
      return;
    }
    chrome.runtime.sendMessage({ type: "openSuggestion", id });
  });

  const pause = document.createElement("button");
  pause.type = "button";
  pause.className = "secondary";
  pause.textContent = "Pause session";
  pause.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "pauseSession" });
  });

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dismissPanel(startedAt);
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dismissPanel(startedAt);
  });

  panel.append(title, message, meterLabels, meter, caption, another, openButton, pause, dismiss);
  shadow.append(style, panel);
  document.documentElement.append(host);
  updateOpenPanel(session);
  dismiss.focus({ focusVisible: true });
}
