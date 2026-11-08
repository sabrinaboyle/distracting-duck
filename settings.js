var DISTRACTION_DUCK_SETTINGS = {
  maxSitesPerList: 8,
  idleSeconds: 30,
  suggestionUrl: "http://127.0.0.1:8787/suggestion",
  geminiTimeoutMs: 60_000,
  geminiPoolSize: 3,
  meter: {
    min: 0,
    max: 100,
    start: 50,
    focusPerSecond: 1.2,
    distractPerSecond: 1.6,
    mallardDistractPerSecond: 2.2,
  },
};

var DISTRACTION_DUCK_MODES = [
  {
    id: "distracted-duck",
    name: "Distracted Duck",
    summary: "Playful detours on distracting sites. The default.",
    theme: {
      bg: "#f6f3ec",
      ink: "#1c1917",
      muted: "#44403c",
      stripe: "#b45309",
      button: "#14352e",
      buttonHover: "#0f2924",
      fill: "linear-gradient(90deg, #b45309, #14352e)",
    },
  },
  {
    id: "malicious-mallard",
    name: "Malicious Mallard",
    summary: "Cheeky, more persistent suggestions. Never insults you.",
    theme: {
      bg: "#fdecec",
      ink: "#3f0d0d",
      muted: "#7f1d1d",
      stripe: "#b91c1c",
      button: "#991b1b",
      buttonHover: "#7f1d1d",
      fill: "linear-gradient(90deg, #dc2626, #7f1d1d)",
    },
  },
  {
    id: "locked-in-loon",
    name: "Locked-in Loon",
    summary: "Encouragement on focus sites, and a light reminder on distracting ones.",
    theme: {
      bg: "#eef4ff",
      ink: "#0f2744",
      muted: "#1e3a5f",
      stripe: "#1d4ed8",
      button: "#1e40af",
      buttonHover: "#1e3a8a",
      fill: "linear-gradient(90deg, #60a5fa, #1e3a8a)",
    },
  },
];
