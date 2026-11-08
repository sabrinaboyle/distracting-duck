function distractionDuckHostPattern(website) {
  return `${distractionDuckOrigin(website)}/*`;
}

function distractionDuckOrigin(website) {
  const url = new URL(website);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Distraction Duck can only use an http or https website.");
  }
  return url.origin;
}

function distractionDuckSameSite(pageUrl, selectedWebsite) {
  try {
    return new URL(pageUrl).origin === distractionDuckOrigin(selectedWebsite);
  } catch {
    return false;
  }
}

function distractionDuckMatchesList(pageUrl, websites) {
  if (!pageUrl || !Array.isArray(websites)) {
    return false;
  }
  return websites.some((website) => distractionDuckSameSite(pageUrl, website));
}

function distractionDuckUniqueOrigins(websites) {
  const origins = [];
  const seen = new Set();
  for (const website of websites || []) {
    try {
      const origin = distractionDuckOrigin(website);
      if (!seen.has(origin)) {
        seen.add(origin);
        origins.push(origin);
      }
    } catch {
      // Skip values that are not http(s) websites.
    }
  }
  return origins;
}

function distractionDuckOverlappingOrigins(focusSites, distractingSites) {
  const focus = new Set(distractionDuckUniqueOrigins(focusSites));
  return distractionDuckUniqueOrigins(distractingSites).filter((origin) => focus.has(origin));
}
