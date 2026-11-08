function distractionDuckHostPattern(website) {
  const url = new URL(website);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Distraction Duck can only request an http or https website.");
  }
  return `${url.origin}/*`;
}

function distractionDuckSameSite(pageUrl, selectedWebsite) {
  try {
    const page = new URL(pageUrl);
    const selected = new URL(selectedWebsite);
    return page.origin === selected.origin;
  } catch {
    return false;
  }
}
