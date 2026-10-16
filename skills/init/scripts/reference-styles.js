() => {
  // facha-ui · /facha-ui:init reference (B-028). Passed as is to Playwright's browser_evaluate on the
  // page the developer named. Read-only: it reads computed styles and element sizes, never the page's
  // text, images or storage, and sends nothing anywhere. Its output is data for the plugin.
  const MAX = 2500;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };
  const where = (el) => {
    const cls = [...el.classList].slice(0, 2).map((c) => "." + c.replace(/[^\w-]/g, "")).join("");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id.replace(/[^\w-]/g, "") : "") + cls;
  };
  const style = (el, props) => {
    const s = getComputedStyle(el);
    const out = { from: where(el) };
    for (const p of props) out[p] = s.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    out.height = Math.round(r.height);
    return out;
  };
  const opaque = (c) => !!c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);
  const TEXT = ["color", "font-family", "font-size", "font-weight"];
  const BOX = ["background-color", "color", "border-top-color", "border-top-width", "border-top-left-radius", "font-family", "font-size", "font-weight"];

  const all = [...document.body.querySelectorAll("*")].slice(0, MAX).filter(visible);
  const firstOf = (selector) => all.find((el) => el.matches(selector));

  // Backgrounds by area: the page's own colors, biggest first.
  const areas = new Map();
  for (const el of [document.documentElement, document.body, ...all]) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!opaque(bg)) continue;
    const r = el.getBoundingClientRect();
    areas.set(bg, (areas.get(bg) || 0) + Math.round(r.width * r.height));
  }
  const backgrounds = [...areas].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color, area]) => ({ color, area }));

  // The primary button: the biggest button-like element with a background of its own.
  const buttons = all.filter((el) => el.matches('button, [role="button"], input[type="submit"], a[class*="btn"], a[class*="button"], a[class*="Button"]'));
  const filled = buttons.filter((el) => opaque(getComputedStyle(el).backgroundColor));
  const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
  const primary = filled.sort((a, b) => area(b) - area(a))[0];

  const link = all.find((el) => el.tagName === "A" && !buttons.includes(el));
  const card = all.find((el) => {
    const s = getComputedStyle(el);
    return el.tagName !== "BUTTON" && parseFloat(s.borderTopLeftRadius) > 0 && (parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== "none") && el.getBoundingClientRect().width > 160;
  });
  const input = firstOf('input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), select, textarea');

  return {
    viewport: { width: innerWidth, height: innerHeight },
    body: style(document.body, ["background-color", ...TEXT]),
    headings: ["h1", "h2", "h3"].map((t) => firstOf(t)).filter(Boolean).map((el) => style(el, TEXT)),
    button: primary ? style(primary, BOX) : null,
    buttons: buttons.length,
    link: link ? style(link, TEXT) : null,
    card: card ? style(card, BOX) : null,
    input: input ? style(input, BOX) : null,
    backgrounds,
  };
}
