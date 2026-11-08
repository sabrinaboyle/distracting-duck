var DISTRACTION_DUCK_SESSION_KEY = "focusSession";

function distractionDuckModeById(id) {
  return DISTRACTION_DUCK_MODES.find((mode) => mode.id === id) || DISTRACTION_DUCK_MODES[0];
}

function distractionDuckValidWebsites(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const unique = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") {
      continue;
    }
    try {
      const origin = distractionDuckOrigin(item);
      if (!seen.has(origin)) {
        seen.add(origin);
        unique.push(origin);
      }
    } catch {
      // Drop invalid entries.
    }
  }
  return unique.slice(0, DISTRACTION_DUCK_SETTINGS.maxSitesPerList);
}

function distractionDuckClassifyPage(pageUrl, session) {
  if (!session) {
    return "other";
  }
  if (distractionDuckMatchesList(pageUrl, session.focusSites)) {
    return "focus";
  }
  if (distractionDuckMatchesList(pageUrl, session.distractingSites)) {
    return "distract";
  }
  return "other";
}

function distractionDuckShouldShowPanel(session, pageUrl) {
  if (!session || session.active !== true || session.paused) {
    return false;
  }
  const kind = distractionDuckClassifyPage(pageUrl, session);
  if (kind === "distract") {
    return true;
  }
  return kind === "focus" && session.birdMode === "locked-in-loon";
}

function distractionDuckSessionOrigins(session) {
  if (!session) {
    return [];
  }
  return distractionDuckUniqueOrigins([
    ...(session.focusSites || []),
    ...(session.distractingSites || []),
  ]);
}

function distractionDuckHostPatterns(session) {
  return distractionDuckSessionOrigins(session).map((origin) => `${origin}/*`);
}

function distractionDuckNormalizeSession(raw) {
  if (!raw || typeof raw !== "object" || raw.active !== true) {
    return null;
  }
  if (typeof raw.task !== "string" || !raw.task.trim()) {
    return null;
  }
  if (!raw.workTab || typeof raw.workTab.id !== "number") {
    return null;
  }

  let distractingSites = distractionDuckValidWebsites(raw.distractingSites);
  if (!distractingSites.length && typeof raw.distraction === "string") {
    distractingSites = distractionDuckValidWebsites([raw.distraction]);
  }
  const focusSites = distractionDuckValidWebsites(raw.focusSites);
  if (!distractingSites.length && !focusSites.length) {
    return null;
  }
  if (distractionDuckOverlappingOrigins(focusSites, distractingSites).length) {
    return null;
  }

  const mode = distractionDuckModeById(raw.birdMode);
  const now = typeof raw.startedAt === "number" ? raw.startedAt : 0;
  const meter = raw.meter && typeof raw.meter.value === "number"
    ? {
        value: distractionDuckClampMeter(raw.meter.value),
        updatedAt: typeof raw.meter.updatedAt === "number" ? raw.meter.updatedAt : now,
        phase: ["focus", "distract", "pause"].includes(raw.meter.phase) ? raw.meter.phase : "pause",
      }
    : {
        value: DISTRACTION_DUCK_SETTINGS.meter.start,
        updatedAt: now,
        phase: "pause",
      };

  return {
    active: true,
    paused: raw.paused === true,
    task: raw.task.trim(),
    birdMode: mode.id,
    distractingSites,
    focusSites,
    startedAt: now,
    workTab: {
      id: raw.workTab.id,
      windowId: raw.workTab.windowId,
      title: typeof raw.workTab.title === "string" ? raw.workTab.title : "",
      url: typeof raw.workTab.url === "string" ? raw.workTab.url : "",
    },
    meter,
  };
}

function distractionDuckCreateSession({
  task,
  birdMode,
  distractingSites,
  focusSites,
  workTab,
  now,
}) {
  return distractionDuckNormalizeSession({
    active: true,
    paused: false,
    task,
    birdMode,
    distractingSites,
    focusSites,
    startedAt: now,
    workTab,
    meter: {
      value: DISTRACTION_DUCK_SETTINGS.meter.start,
      updatedAt: now,
      phase: "pause",
    },
  });
}
