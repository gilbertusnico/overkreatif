/*
 * Small effects shared by the homepage and product-page motion bundles.
 * Everything here ends exactly in the element's original state.
 */

/* ------------------------------------------------------------------ */
/* Icon line drawing                                                   */
/* ------------------------------------------------------------------ */
// Stroke icons "draw themselves". stroke-dasharray/-dashoffset are inherited, so setting
// them on the <svg> also reaches <use>-referenced symbols. 300 is longer than any icon
// path in a 24px viewBox, so every stroke starts fully hidden and ends fully drawn.
const DASH = 300;

export function primeDraw(svg) {
  stopDraw(svg);
  svg.style.strokeDasharray = String(DASH);
  svg.style.strokeDashoffset = String(DASH);
}

function stopDraw(svg) {
  if (svg._draw) {
    svg._draw.onfinish = null;
    svg._draw.cancel();
    svg._draw = null;
  }
}

export function playDraw(svg, delay = 0, duration = 1.1) {
  const clear = () => {
    svg.style.removeProperty("stroke-dasharray");
    svg.style.removeProperty("stroke-dashoffset");
  };
  stopDraw(svg);
  if (!svg.animate) return clear();
  const anim = svg.animate([{ strokeDashoffset: DASH }, { strokeDashoffset: 0 }], {
    duration: duration * 1000,
    delay: delay * 1000,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    fill: "both",
  });
  svg._draw = anim;
  anim.onfinish = () => {
    clear();
    anim.cancel();
    svg._draw = null;
  };
}

// Draw the icon every time it scrolls into view, not just the first time: once it has left
// the viewport completely it is quietly reset (off-screen, so nobody sees it vanish), and the
// next time at least half of it is visible it draws again.
// With { first: false } the caller handles the first draw (e.g. timed with a card reveal) and
// this only takes over for later visits.
export function drawInView(svg, { delay = 0.15, duration = 1, first = true } = {}) {
  let armed = first;
  if (first) primeDraw(svg);
  if (!("IntersectionObserver" in window)) {
    if (first) playDraw(svg, delay, duration);
    return;
  }
  new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (!e.isIntersecting) {
        if (!armed) {
          armed = true;
          primeDraw(svg);
        }
      } else if (armed && e.intersectionRatio >= 0.5) {
        armed = false;
        playDraw(svg, delay, duration);
      }
    },
    { threshold: [0, 0.5] }
  ).observe(svg);
}

/* ------------------------------------------------------------------ */
/* Ripple: stagger by distance from the group's centre                 */
/* ------------------------------------------------------------------ */
// Returns a 0..1 factor per item (0 = closest to the centre of the group).
export function rippleFactors(items) {
  const rects = items.map((el) => el.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const d = rects.map((r) => Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy));
  const max = Math.max(...d) || 1;
  return d.map((v) => v / max);
}

/* ------------------------------------------------------------------ */
/* Text decode / scramble                                              */
/* ------------------------------------------------------------------ */
// Letters and digits cycle through random characters, then lock in from left to right.
// Only text nodes change, so inline markup (dots, comments, spans) is preserved.
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGIT = "0123456789";

export function scramble(el, { delay = 0, duration = 0.9 } = {}) {
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) if (n.textContent.trim()) nodes.push({ node: n, text: n.textContent });
  const total = nodes.reduce((sum, x) => sum + x.text.length, 0);
  if (!total) return;

  // Shrink-wrapped boxes (inline, or items of a flex/grid parent such as a pill badge) would change
  // width as random glyphs come and go: hold the width steady while scrambling.
  const display = getComputedStyle(el).display;
  const parentDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : "";
  const inline = display.startsWith("inline") || /flex|grid/.test(parentDisplay);
  // Text that already wraps (e.g. a long badge on a narrow phone) must keep wrapping, or it
  // would run off the screen while scrambling: hold its box size instead of forcing one line.
  const box = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
  const multiLine = box.height > lineH * 1.5;
  if (inline) {
    el.style.width = box.width + "px";
    if (multiLine) el.style.height = box.height + "px";
    else el.style.whiteSpace = "nowrap";
  }

  const pick = (set) => set[(Math.random() * set.length) | 0];
  const randomFor = (ch) =>
    /[A-Z]/.test(ch) ? pick(UPPER) : /[a-z]/.test(ch) ? pick(LOWER) : /[0-9]/.test(ch) ? pick(DIGIT) : ch;

  const render = (lockedCount) => {
    let i = 0;
    nodes.forEach((x) => {
      let s = "";
      for (const ch of x.text) {
        s += i < lockedCount ? ch : randomFor(ch);
        i++;
      }
      x.node.textContent = s;
    });
  };
  const restore = () => {
    nodes.forEach((x) => (x.node.textContent = x.text));
    if (inline) {
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("white-space");
    }
  };

  render(0);
  const start = performance.now() + delay * 1000;
  let last = 0;
  const tick = (now) => {
    if (now < start) return requestAnimationFrame(tick);
    const p = Math.min(1, (now - start) / (duration * 1000));
    if (p >= 1) return restore();
    if (now - last > 45) {
      // ease-out lock-in: characters settle faster at the start, slower at the end
      render(Math.floor(total * (1 - Math.pow(1 - p, 2))));
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
