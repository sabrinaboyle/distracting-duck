function distractionDuckClampMeter(value) {
  const { min, max } = DISTRACTION_DUCK_SETTINGS.meter;
  return Math.min(max, Math.max(min, value));
}

function distractionDuckMeterRate(session, phase) {
  if (!session || session.paused || phase === "pause" || phase === "other") {
    return 0;
  }
  if (phase === "focus") {
    return DISTRACTION_DUCK_SETTINGS.meter.focusPerSecond;
  }
  if (phase === "distract") {
    return session.birdMode === "malicious-mallard"
      ? -DISTRACTION_DUCK_SETTINGS.meter.mallardDistractPerSecond
      : -DISTRACTION_DUCK_SETTINGS.meter.distractPerSecond;
  }
  return 0;
}

function distractionDuckProjectMeter(session, now) {
  const fallback = {
    value: DISTRACTION_DUCK_SETTINGS.meter.start,
    updatedAt: now,
    phase: "pause",
  };
  const meter = session && session.meter ? session.meter : fallback;
  const elapsedSec = Math.max(0, (now - meter.updatedAt) / 1000);
  const rate = distractionDuckMeterRate(session, meter.phase);
  return {
    value: distractionDuckClampMeter(meter.value + rate * elapsedSec),
    updatedAt: now,
    phase: meter.phase,
  };
}

function distractionDuckCommitMeter(session, phase, now) {
  const projected = distractionDuckProjectMeter(session, now);
  return {
    value: projected.value,
    updatedAt: now,
    phase: phase || "pause",
  };
}

function distractionDuckMeterLabel(value) {
  const rounded = Math.round(value);
  if (rounded >= 60) {
    return `Locked-in side, ${rounded} of 100`;
  }
  if (rounded <= 40) {
    return `Distracted side, ${rounded} of 100`;
  }
  return `In the middle, ${rounded} of 100`;
}
