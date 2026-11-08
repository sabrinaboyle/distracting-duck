const loading = document.querySelector("#loading");
const setupView = document.querySelector("#setup-view");
const activeView = document.querySelector("#active-view");
const form = document.querySelector("#session-form");
const taskInput = document.querySelector("#task");
const formError = document.querySelector("#form-error");
const startButton = document.querySelector("#start-button");
const sessionStatus = document.querySelector("#session-status");
const pauseStatus = document.querySelector("#pause-status");
const activeTask = document.querySelector("#active-task");
const activeMode = document.querySelector("#active-mode");
const activeFocus = document.querySelector("#active-focus");
const activeDistract = document.querySelector("#active-distract");
const activeWorkTab = document.querySelector("#active-work-tab");
const pauseButton = document.querySelector("#pause-button");
const stopButton = document.querySelector("#stop-button");
const focusList = document.querySelector("#focus-list");
const distractList = document.querySelector("#distract-list");
const focusInput = document.querySelector("#focus-input");
const distractInput = document.querySelector("#distract-input");
const conflictBox = document.querySelector("#conflict");
const conflictTitle = document.querySelector("#conflict-title");
const meterEl = document.querySelector("#meter");
const meterFill = document.querySelector("#meter-fill");
const modeChoices = document.querySelector("#mode-choices");
const activeModeChoices = document.querySelector("#active-mode-choices");

const draft = {
  distractingSites: [],
  focusSites: [],
};

let pendingConflict = null;
let meterTimer = null;

function selectedMode(container) {
  return container.querySelector("input[type='radio']:checked")?.value || "distracted-duck";
}

function applyPopupTheme(birdMode) {
  document.body.dataset.birdMode = distractionDuckModeById(birdMode).id;
}

function renderModeChoices(container, name, selected) {
  container.replaceChildren();
  for (const mode of DISTRACTION_DUCK_MODES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = mode.id;
    input.checked = mode.id === selected;
    const text = document.createElement("span");
    text.textContent = `${mode.name}. ${mode.summary}`;
    label.append(input, text);
    container.append(label);
  }
}

function renderSiteList(listEl, sites, listName) {
  listEl.replaceChildren();
  for (const site of sites) {
    const item = document.createElement("li");
    item.className = "site-item";
    const label = document.createElement("span");
    label.textContent = site;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${site}`);
    remove.addEventListener("click", () => {
      draft[listName] = draft[listName].filter((entry) => entry !== site);
      renderDraftLists();
    });
    item.append(label, remove);
    listEl.append(item);
  }
}

function renderDraftLists() {
  renderSiteList(focusList, draft.focusSites, "focusSites");
  renderSiteList(distractList, draft.distractingSites, "distractingSites");
}

function showSetup() {
  loading.hidden = true;
  activeView.hidden = true;
  setupView.hidden = false;
  stopMeterTimer();
  if (!modeChoices.children.length) {
    renderModeChoices(modeChoices, "bird-mode", "distracted-duck");
  }
  renderDraftLists();
  applyPopupTheme(selectedMode(modeChoices));
  taskInput.focus();
}

function listText(sites) {
  return sites.length ? sites.join(", ") : "None";
}

function renderWorkTab(workTab) {
  activeWorkTab.replaceChildren();
  if (!workTab) {
    activeWorkTab.textContent = "The current tab could not be saved.";
    return;
  }
  const title = (workTab.title || "").trim();
  const url = (workTab.url || "").trim();
  if (title) {
    const titleLine = document.createElement("span");
    titleLine.className = "work-title";
    titleLine.textContent = title;
    activeWorkTab.append(titleLine);
  }
  if (url) {
    const urlLine = document.createElement("span");
    urlLine.className = "work-url";
    urlLine.textContent = url;
    activeWorkTab.append(urlLine);
  }
  if (!title && !url) {
    activeWorkTab.textContent = "Current tab";
  }
}

function renderMeter(session) {
  const projected = distractionDuckProjectMeter(session, Date.now());
  const value = Math.round(projected.value);
  meterFill.style.width = `${value}%`;
  meterEl.setAttribute("aria-valuenow", String(value));
  meterEl.setAttribute("aria-valuetext", distractionDuckMeterLabel(projected.value));
}

function startMeterTimer(session) {
  stopMeterTimer();
  renderMeter(session);
  meterTimer = setInterval(async () => {
    const current = await readSession();
    if (!current) {
      stopMeterTimer();
      return;
    }
    renderMeter(current);
  }, 1000);
}

function stopMeterTimer() {
  if (meterTimer) {
    clearInterval(meterTimer);
    meterTimer = null;
  }
}

function showActive(session) {
  const becameVisible = activeView.hidden;
  loading.hidden = true;
  setupView.hidden = true;
  activeView.hidden = false;
  sessionStatus.textContent = session.paused ? "Focus session is paused" : "Focus session is active";
  pauseStatus.hidden = !session.paused;
  pauseButton.textContent = session.paused ? "Resume session" : "Pause session";
  activeTask.textContent = session.task;
  activeMode.textContent = distractionDuckModeById(session.birdMode).name;
  activeFocus.textContent = listText(session.focusSites);
  activeDistract.textContent = listText(session.distractingSites);
  renderWorkTab(session.workTab);
  renderModeChoices(activeModeChoices, "active-bird-mode", session.birdMode);
  renderMeter(session);
  applyPopupTheme(session.birdMode);
  startMeterTimer(session);
  if (becameVisible) {
    sessionStatus.focus({ focusVisible: true });
  }
}

function showError(message, focusTarget) {
  formError.textContent = message;
  formError.hidden = false;
  (focusTarget || formError).focus();
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

function hideConflict() {
  pendingConflict = null;
  conflictBox.hidden = true;
}

function showConflict(origin) {
  pendingConflict = origin;
  conflictTitle.textContent = `${origin} is on both lists. A website can be a focus site or a distracting site, not both. Choose one.`;
  conflictBox.hidden = false;
  document.querySelector("#conflict-focus").focus();
}

function websiteFromInput(input) {
  return input.value.trim();
}

function addWebsite(listName, rawValue, sourceInput) {
  clearError();
  hideConflict();
  if (!rawValue) {
    showError("Enter a full address, such as https://example.com.", sourceInput);
    return;
  }
  let origin;
  try {
    origin = distractionDuckOrigin(rawValue);
  } catch {
    showError("Enter a full address, such as https://example.com.", sourceInput);
    return;
  }
  const otherName = listName === "focusSites" ? "distractingSites" : "focusSites";
  if (draft[listName].includes(origin)) {
    sourceInput.value = "";
    return;
  }
  if (draft[listName].length >= DISTRACTION_DUCK_SETTINGS.maxSitesPerList) {
    showError(`You can add up to ${DISTRACTION_DUCK_SETTINGS.maxSitesPerList} sites on each list.`, sourceInput);
    return;
  }
  if (draft[otherName].includes(origin)) {
    showConflict(origin);
    return;
  }
  draft[listName].push(origin);
  sourceInput.value = "";
  renderDraftLists();
}

function resolveConflict(choice) {
  if (!pendingConflict) {
    return;
  }
  const origin = pendingConflict;
  if (choice === "focus") {
    draft.focusSites = distractionDuckValidWebsites([...draft.focusSites, origin]);
    draft.distractingSites = draft.distractingSites.filter((site) => site !== origin);
  } else if (choice === "distract") {
    draft.distractingSites = distractionDuckValidWebsites([...draft.distractingSites, origin]);
    draft.focusSites = draft.focusSites.filter((site) => site !== origin);
  }
  hideConflict();
  renderDraftLists();
}

async function readSession() {
  const stored = await chrome.storage.local.get(DISTRACTION_DUCK_SESSION_KEY);
  return distractionDuckNormalizeSession(stored[DISTRACTION_DUCK_SESSION_KEY]);
}

function setupAddField(input, button, listName) {
  button.addEventListener("click", () => addWebsite(listName, websiteFromInput(input), input));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addWebsite(listName, websiteFromInput(input), input);
    }
  });
}

modeChoices.addEventListener("change", () => {
  applyPopupTheme(selectedMode(modeChoices));
});

setupAddField(focusInput, document.querySelector("#focus-add"), "focusSites");
setupAddField(distractInput, document.querySelector("#distract-add"), "distractingSites");
document.querySelector("#conflict-focus").addEventListener("click", () => resolveConflict("focus"));
document.querySelector("#conflict-distract").addEventListener("click", () => resolveConflict("distract"));
document.querySelector("#conflict-cancel").addEventListener("click", hideConflict);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = taskInput.value.trim();
  if (!task) {
    showError("Enter a task.", taskInput);
    return;
  }
  if (!draft.focusSites.length && !draft.distractingSites.length) {
    showError("Add at least one focus website or distracting website.", focusInput);
    return;
  }
  const overlap = distractionDuckOverlappingOrigins(draft.focusSites, draft.distractingSites);
  if (overlap.length) {
    showConflict(overlap[0]);
    return;
  }

  clearError();
  const patterns = distractionDuckUniqueOrigins([...draft.focusSites, ...draft.distractingSites]).map(
    (origin) => `${origin}/*`,
  );
  const birdMode = selectedMode(modeChoices);
  startButton.disabled = true;
  chrome.permissions.request({ origins: patterns }).then(async (granted) => {
    if (!granted) {
      showError("Allow access to the websites you selected so the bird can appear there.", formError);
      return;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || typeof tab.id !== "number") {
        showError("The current tab could not be saved. Stay on your work tab and try again.", formError);
        return;
      }
      const session = distractionDuckCreateSession({
        task,
        birdMode,
        distractingSites: draft.distractingSites,
        focusSites: draft.focusSites,
        workTab: {
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title || "",
          url: tab.url || "",
        },
        now: Date.now(),
      });
      if (!session) {
        showError("The session could not be saved. Check the site lists and try again.", formError);
        return;
      }
      await chrome.storage.local.set({ [DISTRACTION_DUCK_SESSION_KEY]: session });
      showActive(session);
    } catch {
      showError("The session could not be saved. Try again.", formError);
    }
  }).catch(() => {
    showError("The website permission could not be requested. Try again.", formError);
  }).finally(() => {
    startButton.disabled = false;
  });
});

pauseButton.addEventListener("click", async () => {
  const session = await readSession();
  if (!session) {
    showSetup();
    return;
  }
  session.paused = !session.paused;
  session.meter = distractionDuckCommitMeter(
    session,
    session.paused ? "pause" : session.meter.phase,
    Date.now(),
  );
  await chrome.storage.local.set({ [DISTRACTION_DUCK_SESSION_KEY]: session });
  showActive(session);
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    const session = await readSession();
    await chrome.storage.local.remove(DISTRACTION_DUCK_SESSION_KEY);
    if (session) {
      taskInput.value = session.task;
      draft.focusSites = session.focusSites.slice();
      draft.distractingSites = session.distractingSites.slice();
      renderModeChoices(modeChoices, "bird-mode", session.birdMode);
    }
    clearError();
    hideConflict();
    showSetup();
  } catch {
    showSetup();
  } finally {
    stopButton.disabled = false;
  }
});

activeModeChoices.addEventListener("change", async () => {
  const session = await readSession();
  if (!session) {
    return;
  }
  session.birdMode = selectedMode(activeModeChoices);
  await chrome.storage.local.set({ [DISTRACTION_DUCK_SESSION_KEY]: session });
  showActive(session);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, DISTRACTION_DUCK_SESSION_KEY)) {
    return;
  }
  const session = distractionDuckNormalizeSession(changes[DISTRACTION_DUCK_SESSION_KEY].newValue);
  if (session && !activeView.hidden) {
    showActive(session);
  }
});

readSession()
  .then((session) => {
    if (session) {
      draft.focusSites = session.focusSites.slice();
      draft.distractingSites = session.distractingSites.slice();
      showActive(session);
    } else {
      showSetup();
    }
  })
  .catch(() => {
    showSetup();
  });
