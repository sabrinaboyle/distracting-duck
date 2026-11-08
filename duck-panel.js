const MALLARD_MESSAGE =
  "This is the distracting website you picked. I'm Malicious Mallard. Stay and wander, or waddle back to your work tab.";

const PANEL_HOST_ID = "distraction-duck-panel-host";
const SESSION_KEY = "focusSession";

if (window === window.top && !window.distractionDuckPanel) {
  window.distractionDuckPanel = {
    startedAt: null,
    status: "idle",
    chain: Promise.resolve(),
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, SESSION_KEY)) {
      return;
    }
    schedulePanelSync();
  });
  schedulePanelSync();
}

function schedulePanelSync() {
  const state = window.distractionDuckPanel;
  state.chain = state.chain.then(syncPanel, syncPanel);
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
  if (!session || !distractionDuckSameSite(location.href, session.distraction)) {
    removePanelHost();
    state.status = "hidden";
    state.startedAt = null;
    return;
  }
  if (state.status === "dismissed" && state.startedAt === startedAt) {
    return;
  }
  if (state.status === "shown" && state.startedAt === startedAt && document.getElementById(PANEL_HOST_ID)) {
    return;
  }
  removePanelHost();
  state.status = "shown";
  state.startedAt = startedAt;
  mountPanel(startedAt);
}

async function readPanelSession() {
  try {
    const stored = await chrome.storage.local.get(SESSION_KEY);
    const session = stored[SESSION_KEY];
    if (!session || session.active !== true || typeof session.distraction !== "string") {
      return null;
    }
    return {
      distraction: session.distraction,
      startedAt: typeof session.startedAt === "number" ? session.startedAt : 0,
    };
  } catch {
    return null;
  }
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

function mountPanel(startedAt) {
  if (document.getElementById(PANEL_HOST_ID)) {
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
      margin: 0 0 0.85rem;
    }
    button {
      width: 100%;
      min-height: 2.75rem;
      padding: 0.5rem 0.8rem;
      border: 2px solid #14352e;
      border-radius: 0.5rem;
      background: #14352e;
      color: #ffffff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover {
      background: #0f2924;
      border-color: #0f2924;
    }
    button:focus-visible {
      outline: 3px solid #1d4ed8;
      outline-offset: 2px;
    }
  `;

  const panel = document.createElement("section");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", "distraction-duck-title");
  panel.setAttribute("aria-live", "polite");

  const title = document.createElement("h2");
  title.id = "distraction-duck-title";
  title.textContent = "Malicious Mallard";

  const message = document.createElement("p");
  message.textContent = MALLARD_MESSAGE;

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

  panel.append(title, message, dismiss);
  shadow.append(style, panel);
  document.documentElement.append(host);

  dismiss.focus({ focusVisible: true});
}
