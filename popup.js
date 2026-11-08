const SESSION_KEY = "focusSession";

const loading = document.querySelector("#loading");
const setupView = document.querySelector("#setup-view");
const activeView = document.querySelector("#active-view");
const form = document.querySelector("#session-form");
const taskInput = document.querySelector("#task");
const siteInput = document.querySelector("#distraction");
const formError = document.querySelector("#form-error");
const startButton = document.querySelector("#start-button");
const sessionStatus = document.querySelector("#session-status");
const activeTask = document.querySelector("#active-task");
const activeSite = document.querySelector("#active-site");
const activeWorkTab = document.querySelector("#active-work-tab");
const stopButton = document.querySelector("#stop-button");

function showSetup() {
  loading.hidden = true;
  activeView.hidden = true;
  setupView.hidden = false;
  taskInput.focus();
}

function showActive(session) {
  loading.hidden = true;
  setupView.hidden = true;
  activeView.hidden = false;
  activeTask.textContent = session.task;
  activeSite.textContent = session.distraction;
  renderWorkTab(session.workTab);
  sessionStatus.focus({ focusVisible: true });
}

function renderWorkTab(workTab) {
  activeWorkTab.replaceChildren();
  if (!workTab) {
    activeWorkTab.textContent = "The current tab could not be saved.";
    return;
  }

  const title = workTab.title.trim();
  const url = workTab.url.trim();
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

function invalidWebsite(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return true;
  }
  return url.protocol !== "http:" && url.protocol !== "https:";
}

function validationMessage(task, distraction) {
  if (!task || !distraction) {
    return "Enter a task and one distracting website.";
  }
  if (invalidWebsite(distraction)) {
    return "Enter a full address, such as https://example.com.";
  }
  return "";
}

function showError(message, focusTarget) {
  formError.textContent = message;
  formError.hidden = false;
  const taskMissing = taskInput.value.trim() === "";
  const siteValue = siteInput.value.trim();
  const siteInvalid = siteValue === "" || invalidWebsite(siteValue);
  taskInput.setAttribute("aria-invalid", String(taskMissing));
  siteInput.setAttribute("aria-invalid", String(siteInvalid));
  taskInput.setAttribute("aria-describedby", "form-error");
  siteInput.setAttribute("aria-describedby", "distraction-hint form-error");
  const field = focusTarget || (taskMissing ? taskInput : siteInput);
  field.focus();
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
  taskInput.removeAttribute("aria-invalid");
  siteInput.removeAttribute("aria-invalid");
  taskInput.removeAttribute("aria-describedby");
  siteInput.setAttribute("aria-describedby", "distraction-hint");
}

async function readSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  const session = stored[SESSION_KEY];
  if (!session || session.active !== true) {
    return null;
  }
  if (typeof session.task !== "string" || typeof session.distraction !== "string") {
    return null;
  }
  if (!session.workTab || typeof session.workTab.id !== "number") {
    return null;
  }
  return session;
}

siteInput.addEventListener("invalid", (event) => {
  event.preventDefault();
  const task = taskInput.value.trim();
  showError(
    task
      ? "Enter a full address, such as https://example.com."
      : "Enter a task and one distracting website.",
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const task = taskInput.value.trim();
  const distraction = siteInput.value.trim();
  const message = validationMessage(task, distraction);
  if (message) {
    showError(message);
    return;
  }

  clearError();
  startButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number") {
      showError(
        "The current tab could not be saved. Stay on your work tab and try again.",
        formError,
      );
      return;
    }

    const session = {
      active: true,
      task,
      distraction,
      workTab: {
        id: tab.id,
        windowId: tab.windowId,
        title: tab.title || "",
        url: tab.url || "",
      },
    };
    await chrome.storage.local.set({ [SESSION_KEY]: session });
    showActive(session);
  } catch {
    showError("The session could not be saved. Try again.", formError);
  } finally {
    startButton.disabled = false;
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    const session = await readSession();
    await chrome.storage.local.remove(SESSION_KEY);
    if (session) {
      taskInput.value = session.task;
      siteInput.value = session.distraction;
    }
    clearError();
    showSetup();
  } catch {
    showSetup();
  } finally {
    stopButton.disabled = false;
  }
});

readSession()
  .then((session) => {
    if (session) {
      showActive(session);
    } else {
      showSetup();
    }
  })
  .catch(() => {
    showSetup();
  });
