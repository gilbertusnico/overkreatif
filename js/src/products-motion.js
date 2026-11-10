/*
 * Overkreatif — product pages motion layer (StockFolio, BillFolio, RentFolio)
 *
 * Built into js/products-motion.min.js with `npm run build:motion`.
 *
 * The three pages come from different templates, so this file recognises
 * patterns instead of page-specific ids. It only adds motion: every element
 * ends in exactly the state the page's own CSS defines (inline styles that
 * Motion commits are removed once an animation finishes).
 *
 * Markup contract: the hero <section> carries [data-pm-hero]. While <html> has
 * .pm-ready (set by an inline script in <head>, never under reduced motion and
 * removed again if this file fails to boot) the hero is hidden until this file
 * has primed its first frame, so nothing flashes.
 */
import { animate as motionAnimate, scroll, inView, hover } from "motion";

/* Motion commits an animation's final values as inline styles one frame after its
   promise resolves, which would re-add anything a .then() callback just cleared and
   block the page's own CSS (e.g. hover transforms). Run .then() callbacks after that
   commit so cleanup sticks. The returned controls are otherwise untouched (scroll() needs them). */
function animate(...args) {
  const controls = motionAnimate(...args);
  const then = controls.then.bind(controls);
  controls.then = (onDone, onError) =>
    then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(onDone && onDone())))), onError);
  return controls;
}

const root = document.documentElement;
window.__pmBooted = true;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduceMotion || !root.classList.contains("pm-ready")) {
  root.classList.remove("pm-ready");
} else {
  init();
}

function init() {
  const EASE = [0.22, 1, 0.36, 1];
  const SPRING = { type: "spring", stiffness: 380, damping: 22 };
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  const handled = new Set();

  injectStyles();

  /* ------------------------------------------------------------------ */
  /* Primitives                                                          */
  /* ------------------------------------------------------------------ */
  const V = {
    up: [{ opacity: "0", transform: "translateY(28px)" }, { opacity: "1", transform: "translateY(0px)" }],
    drop: [{ opacity: "0", transform: "translateY(-14px)" }, { opacity: "1", transform: "translateY(0px)" }],
    left: [{ opacity: "0", transform: "translateX(-44px)" }, { opacity: "1", transform: "translateX(0px)" }],
    right: [{ opacity: "0", transform: "translateX(44px)" }, { opacity: "1", transform: "translateX(0px)" }],
    scale: [{ opacity: "0", transform: "translateY(24px) scale(0.96)" }, { opacity: "1", transform: "translateY(0px) scale(1)" }],
    pop: [{ opacity: "0", transform: "scale(0.4) rotate(-14deg)" }, { opacity: "1", transform: "scale(1) rotate(0deg)" }],
    mask: [{ transform: "translateY(110%)" }, { transform: "translateY(0%)" }],
  };

  // Put an element in its "before" state right away (it is off-screen or hidden).
  function prime(el, v) {
    Object.assign(el.style, V[v][0]);
    handled.add(el);
  }

  // Animate from the primed state to the final one, then hand control back to CSS.
  function play(el, v, delay = 0, duration = 0.85, ease = EASE) {
    const [from, to] = V[v];
    const keyframes = {};
    Object.keys(from).forEach((k) => (keyframes[k] = [from[k], to[k]]));
    return animate(el, keyframes, { delay, duration, ease }).then(() => {
      Object.keys(from).forEach((k) => el.style.removeProperty(k));
    });
  }

  function once(el, fn, amount = 0.15) {
    const stop = inView(
      el,
      () => {
        fn();
        stop();
      },
      { amount, margin: "0px 0px -6% 0px" }
    );
  }

  function reveal(el, v = "up", delay = 0) {
    prime(el, v);
    once(el, () => play(el, v, delay));
  }

  /* Split a heading into masked words. Elements painted with background-clip:text
     (gradient words) stay whole, because splitting them would restart the gradient. */
  function splitWords(node) {
    const out = [];
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) return;
        let text = child.textContent;
        const frag = document.createDocumentFragment();
        // Punctuation glued to the previous element (e.g. "<span>tertata</span>,") must stay on the
        // same line as it: move it into that element's last word, keeping its own colour/style.
        const prev = child.previousSibling;
        const glued = /^\S+/.exec(text);
        const lastWord = out[out.length - 1];
        if (glued && prev && prev.nodeType === Node.ELEMENT_NODE && lastWord && prev.contains(lastWord)) {
          const own = getComputedStyle(child.parentElement);
          const tail = document.createElement("span");
          tail.textContent = glued[0];
          tail.style.color = own.color;
          tail.style.webkitTextFillColor = own.webkitTextFillColor || own.color;
          tail.style.fontStyle = own.fontStyle;
          tail.style.fontWeight = own.fontWeight;
          lastWord.appendChild(tail);
          text = text.slice(glued[0].length);
        }
        text.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(" "));
          const inner = document.createElement("span");
          inner.className = "pm-word";
          inner.textContent = part;
          frag.appendChild(wrapMask(inner));
          out.push(inner);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        const cs = getComputedStyle(child);
        if (cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text") {
          const mask = wrapMask(null);
          child.replaceWith(mask);
          mask.appendChild(child);
          child.classList.add("pm-word");
          out.push(child);
        } else {
          out.push(...splitWords(child));
        }
      }
    });
    return out;
  }
  function wrapMask(inner) {
    const mask = document.createElement("span");
    mask.className = "pm-mask";
    if (inner) mask.appendChild(inner);
    return mask;
  }

  function primeHeading(h) {
    const words = splitWords(h);
    words.forEach((w) => prime(w, "mask"));
    handled.add(h);
    return words;
  }
  function playHeading(words, delay = 0, step = 0.035) {
    // Once a word has landed, drop its mask's clipping: tall or italic glyphs (e.g. Playfair's
    // "J" and "l") reach past any line box, and a permanent overflow:hidden would crop them.
    words.forEach((w, i) =>
      play(w, "mask", delay + i * step, 0.9).then(() => w.parentElement && (w.parentElement.style.overflow = "visible"))
    );
    return delay + words.length * step;
  }

  const containsHandled = (el) => Array.from(handled).some((h) => h !== el && el.contains(h));

  /* ------------------------------------------------------------------ */
  /* 1. Hero: badge → headline words → copy → CTAs → stats, visual rises */
  /* ------------------------------------------------------------------ */
  const hero = document.querySelector("[data-pm-hero]");
  if (hero) {
    const content = hero.firstElementChild;
    const items = content ? Array.from(content.children) : [];
    const visual = hero.children[1] && hero.children[1].querySelector("img") ? hero.children[1] : null;

    let t = 0.1;
    items.forEach((item, i) => {
      if (/^H1$/.test(item.tagName)) {
        const words = primeHeading(item);
        t = playHeading(words, t, 0.045) + 0.05;
        return;
      }
      // Stats bar: stagger its cells instead of moving the whole bar.
      if (item.children.length > 1 && /grid/.test(item.className)) {
        Array.from(item.children).forEach((cell, j) => {
          prime(cell, "up");
          play(cell, "up", t + j * 0.1);
        });
        t += 0.15;
        return;
      }
      const v = i === 0 ? "drop" : "up";
      prime(item, v);
      play(item, v, i === 0 ? 0 : t);
      if (i !== 0) t += 0.1;
    });

    if (visual) {
      const frame = visual.querySelector('[class*="rounded-2xl"]') || visual.firstElementChild;
      const rest = Array.from(visual.children).filter((c) => c !== frame && !c.contains(frame));
      if (frame) {
        frame.style.transformOrigin = "50% 0%";
        frame.style.opacity = "0";
        frame.style.transform = "perspective(1400px) rotateX(18deg) translateY(70px) scale(0.95)";
        animate(
          frame,
          {
            opacity: [0, 1],
            transform: [
              "perspective(1400px) rotateX(18deg) translateY(70px) scale(0.95)",
              "perspective(1400px) rotateX(0deg) translateY(0px) scale(1)",
            ],
          },
          { duration: 1.5, delay: Math.min(t, 0.9), ease: EASE }
        ).then(() => ["opacity", "transform", "transform-origin"].forEach((p) => frame.style.removeProperty(p)));
      }
      rest.forEach((el) => reveal(el, "up", 0.2));
    }

    hero.setAttribute("data-pm-ready", "");
  }

  /* ------------------------------------------------------------------ */
  /* 2. Marquee reacts to scroll speed (and direction)                   */
  /* ------------------------------------------------------------------ */
  const marquee = document.querySelector(".animate-marquee");
  const marqueeAnim = marquee && marquee.getAnimations && marquee.getAnimations()[0];
  if (marqueeAnim) {
    let rate = 1;
    let target = 1;
    let raf = 0;
    const tick = () => {
      rate += (target - rate) * 0.08;
      target += (1 - target) * 0.06; // ease back to normal speed
      marqueeAnim.playbackRate = rate;
      raf = Math.abs(rate - 1) > 0.01 || Math.abs(target - 1) > 0.01 ? requestAnimationFrame(tick) : 0;
      if (!raf) marqueeAnim.playbackRate = 1;
    };
    scroll((_, info) => {
      const v = info.y.velocity;
      target = Math.max(-3, Math.min(5, 1 + v / 450));
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Showcase rows: copy slides from its side, screenshot uncovers    */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("section .grid.items-center").forEach((row) => {
    if (hero && hero.contains(row)) return;
    const kids = Array.from(row.children);
    const frame = kids.find((k) => k.querySelector("img"));
    const copy = kids.find((k) => k !== frame);
    if (!frame || !copy) return;
    const img = frame.querySelector("img");
    const copyFrom = !isDesktop ? "up" : /lg:order-2/.test(copy.className) ? "right" : "left";

    prime(copy, copyFrom);
    handled.add(row);
    handled.add(frame);
    frame.style.clipPath = "inset(12% 10% 12% 10% round 16px)";
    frame.style.opacity = "0";
    img.style.transform = "scale(1.16)";

    once(
      row,
      () => {
        play(copy, copyFrom, 0.15);
        animate(
          frame,
          { clipPath: ["inset(12% 10% 12% 10% round 16px)", "inset(0% 0% 0% 0% round 16px)"], opacity: [0, 1] },
          { duration: 1.3, ease: EASE }
        );
        // Frame stays clipped until the image has settled, so the zoom never spills out.
        animate(img, { transform: ["scale(1.16)", "scale(1)"] }, { duration: 1.3, ease: EASE }).then(() => {
          img.style.removeProperty("transform");
          ["clip-path", "opacity"].forEach((p) => frame.style.removeProperty(p));
        });
      },
      0.2
    );
  });

  /* ------------------------------------------------------------------ */
  /* 4. Timeline: the rail fills with scroll, each dot pops when reached */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('section [class*="border-l-2"]').forEach((rail) => {
    const steps = Array.from(rail.children).filter((c) => c.tagName === "DIV");
    const dots = steps.map((s) => s.querySelector(":scope > span.absolute"));
    if (!steps.length) return;
    handled.add(rail);

    // The fill is a ::before on the rail (no extra child, so space-y / last: utilities are untouched).
    if (getComputedStyle(rail).position === "static") rail.style.position = "relative";
    rail.classList.add("pm-rail");
    const firstDot = dots.find(Boolean);
    if (firstDot) rail.style.setProperty("--pm-rail", getComputedStyle(firstDot).backgroundColor);

    steps.forEach((s) => reveal(s, "up", 0.05));
    dots.forEach((d) => d && (d.style.transform = "scale(0)"));
    const popped = dots.map(() => false);

    const range = { target: rail, offset: ["start 70%", "end 55%"] };
    scroll((progress) => {
      rail.style.setProperty("--pm-p", progress.toFixed(4));
      const h = rail.offsetHeight || 1;
      dots.forEach((d, i) => {
        if (!d || popped[i]) return;
        const at = (steps[i].offsetTop + d.offsetTop + d.offsetHeight / 2) / h;
        if (progress >= at - 0.02) {
          popped[i] = true;
          animate(d, { transform: ["scale(0)", "scale(1.7)", "scale(1)"] }, { duration: 0.6, ease: EASE }).then(() =>
            d.style.removeProperty("transform")
          );
        }
      });
    }, range);
  });

  /* ------------------------------------------------------------------ */
  /* 5. Before / after: panels slide in from opposite sides, rows follow */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('section [class*="md:grid-cols-2"].overflow-hidden').forEach((pair) => {
    const panels = Array.from(pair.children);
    if (panels.length !== 2) return;
    handled.add(pair);
    panels.forEach((p, i) => {
      const v = isDesktop ? (i === 0 ? "left" : "right") : "up";
      const rows = Array.from(p.querySelectorAll("li"));
      prime(p, v);
      rows.forEach((li) => prime(li, "up"));
      once(p, () => {
        play(p, v, i * 0.12, 1);
        rows.forEach((li, j) => play(li, "up", 0.35 + i * 0.12 + j * 0.08, 0.7));
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* 6. Card grids and row lists: staggered entrance                     */
  /* ------------------------------------------------------------------ */
  const groups = [
    ...document.querySelectorAll("section .grid"),
    ...document.querySelectorAll("section .divide-y"),
  ];
  groups.forEach((g) => {
    if (handled.has(g) || (hero && hero.contains(g)) || containsHandled(g)) return;
    const kids = Array.from(g.children);
    const isCards = kids.length > 1 && kids.every((k) => /rounded-2xl|step-card/.test(k.className));
    const isRows = /divide-y/.test(g.className) && kids.length > 1;
    if (!isCards && !isRows) return;
    handled.add(g);

    kids.forEach((k) => prime(k, isCards ? "scale" : "up"));
    const badges = kids.map((k) => k.querySelector(".step-number"));
    badges.forEach((b) => b && prime(b, "pop"));

    once(g, () => {
      kids.forEach((k, i) => {
        play(k, isCards ? "scale" : "up", i * 0.09, 0.85);
        if (badges[i]) play(badges[i], "pop", 0.25 + i * 0.09, 0.9, [0.34, 1.56, 0.64, 1]);
      });
    });

    if (canHover && isCards) cardHover(kids);
  });

  /* ------------------------------------------------------------------ */
  /* 7. Section headings: masked word reveal, eyebrow + intro around it  */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("section h2").forEach((h2) => {
    if (handled.has(h2) || (hero && hero.contains(h2))) return;
    const scope = h2.parentElement;
    const words = primeHeading(h2);

    // Siblings in the heading block, plus the intro paragraph when the block sits in a 2-col header grid.
    let around = Array.from(scope.children).filter((c) => c !== h2);
    if (/\bgrid\b/.test(scope.parentElement.className) && scope.parentElement.children.length <= 3) {
      around = around.concat(Array.from(scope.parentElement.children).filter((c) => c !== scope));
    }
    around = around.filter((el) => !handled.has(el) && !containsHandled(el) && el.tagName !== "SCRIPT");
    const before = around.filter((el) => el.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING);
    const after = around.filter((el) => !before.includes(el));
    around.forEach((el) => prime(el, "up"));

    once(h2, () => {
      before.forEach((el, i) => play(el, "up", i * 0.08, 0.7));
      const end = playHeading(words, before.length ? 0.1 : 0);
      after.forEach((el, i) => play(el, "up", Math.min(end, 0.45) + i * 0.1, 0.8));
    }, 0.4);
  });

  /* ------------------------------------------------------------------ */
  /* 8. Micro-interactions (mouse only)                                  */
  /* ------------------------------------------------------------------ */
  function cardHover(cards) {
    cards.forEach((card) => {
      const icon = card.querySelector(".w-12.h-12, .step-number");
      const dark = /border-white\/10/.test(card.className);
      if (dark) {
        // Dark cards: a soft light follows the cursor.
        card.classList.add("pm-spot");
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--pm-x", `${e.clientX - r.left}px`);
          card.style.setProperty("--pm-y", `${e.clientY - r.top}px`);
        });
      }
      hover(card, () => {
        // Skip while the entrance animation still owns the card.
        if (card.style.opacity || card.style.transform) return;
        animate(card, { transform: "translateY(-4px)" }, SPRING);
        if (icon && !icon.style.opacity) animate(icon, { transform: "scale(1.12) rotate(-8deg)" }, SPRING);
        return () => {
          animate(card, { transform: "translateY(0px)" }, SPRING).then(() => card.style.removeProperty("transform"));
          if (icon) animate(icon, { transform: "scale(1) rotate(0deg)" }, SPRING).then(() => icon.style.removeProperty("transform"));
        };
      });
    });
  }

  if (canHover) {
    // Magnetic CTAs: hero buttons and the closing call to action.
    const sections = document.querySelectorAll("section");
    const last = sections[sections.length - 1];
    const ctas = [
      ...(hero ? hero.querySelectorAll('a[class*="py-3"], a[class*="py-4"]') : []),
      ...(last ? last.querySelectorAll("a") : []),
    ];
    ctas.forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.22;
        animate(btn, { transform: `translate(${x}px, ${y}px)` }, { duration: 0.3, ease: EASE });
      });
      btn.addEventListener("pointerleave", () => {
        animate(btn, { transform: "translate(0px, 0px)" }, SPRING).then(() => btn.style.removeProperty("transform"));
      });
    });
  }
}

function injectStyles() {
  const css = `
    .pm-mask{display:inline-block;overflow:hidden;vertical-align:top;padding:.25em .12em .14em;margin:-.25em -.12em -.14em}
    .pm-word{display:inline-block;will-change:transform}
    .pm-rail::before{content:"";position:absolute;left:-2px;top:0;bottom:0;width:2px;pointer-events:none;
      background:var(--pm-rail,currentColor);transform-origin:top center;transform:scaleY(var(--pm-p,0))}
    .pm-spot{position:relative}
    .pm-spot::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .35s ease;
      background:radial-gradient(280px circle at var(--pm-x,50%) var(--pm-y,50%),rgba(255,255,255,.07),transparent 70%)}
    .pm-spot:hover::after{opacity:1}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
