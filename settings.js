var DISTRACTION_DUCK_SETTINGS = {
  maxSitesPerList: 8,
  idleSeconds: 30,
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
  },
  {
    id: "malicious-mallard",
    name: "Malicious Mallard",
    summary: "Cheeky, more persistent suggestions. Never insults you.",
  },
  {
    id: "locked-in-loon",
    name: "Locked-in Loon",
    summary: "Encouragement on focus sites, and a light reminder on distracting ones.",
  },
];
