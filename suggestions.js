var DISTRACTION_DUCK_SUGGESTION_SOURCE = "prewritten";

var DISTRACTION_DUCK_SUGGESTIONS = {
  "distracted-duck": {
    distract: [
      {
        id: "dd-d1",
        text: "I found a tiny detour: read one short page, then paddle back to your task.",
        url: "https://en.wikipedia.org/wiki/Rubber_duck",
      },
      {
        id: "dd-d2",
        text: "Or skip the internet and stretch for ten seconds. I will still be here, being unhelpful.",
      },
      {
        id: "dd-d3",
        text: "Want a harmless wander? Open a practice page, peek, then close it.",
        url: "https://example.com",
      },
    ],
    focus: [
      {
        id: "dd-f1",
        text: "This is a focus site you chose. I can wait. You do not have to entertain me.",
      },
    ],
  },
  "malicious-mallard": {
    distract: [
      {
        id: "mm-d1",
        text: "I am not going to stop you. I will just sit here while this tab wins another minute.",
      },
      {
        id: "mm-d2",
        text: "A cheeky side quest: open this page, then notice whether you meant to.",
        url: "https://en.wikipedia.org/wiki/Procrastination",
      },
      {
        id: "mm-d3",
        text: "Stay if you want. Your task is still in the other tab, slightly dustier.",
      },
    ],
    focus: [
      {
        id: "mm-f1",
        text: "Focus site. Fine. I can loiter without making a scene.",
      },
    ],
  },
  "locked-in-loon": {
    distract: [
      {
        id: "ll-d1",
        text: "This is one of your distracting sites. A small reminder: your task is still there.",
      },
      {
        id: "ll-d2",
        text: "No rush to feel guilty. When you are ready, your focus list is one tab away.",
      },
    ],
    focus: [
      {
        id: "ll-f1",
        text: "This is a focus site you picked. Nice place to keep the task moving.",
      },
      {
        id: "ll-f2",
        text: "Still on a focus site. That is enough of a win for this minute.",
      },
      {
        id: "ll-f3",
        text: "If you want a calm reset, you can glance at this page, then return.",
        url: "https://en.wikipedia.org/wiki/Pomodoro_Technique",
      },
    ],
  },
};

function distractionDuckSuggestionList(mode, kind) {
  const pack = DISTRACTION_DUCK_SUGGESTIONS[mode] || DISTRACTION_DUCK_SUGGESTIONS["distracted-duck"];
  const list = pack[kind] && pack[kind].length ? pack[kind] : pack.distract;
  return list;
}

function distractionDuckSuggestionById(id) {
  for (const pack of Object.values(DISTRACTION_DUCK_SUGGESTIONS)) {
    for (const list of Object.values(pack)) {
      const found = list.find((item) => item.id === id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function distractionDuckSuggestionForMode(mode, kind, currentId) {
  const list = distractionDuckSuggestionList(mode, kind);
  return list.find((item) => item.id === currentId) || list[0] || null;
}

function distractionDuckNextSuggestion(mode, kind, currentId) {
  const list = distractionDuckSuggestionList(mode, kind);
  if (!list.length) {
    return null;
  }
  const index = list.findIndex((item) => item.id === currentId);
  return list[(index + 1) % list.length];
}
