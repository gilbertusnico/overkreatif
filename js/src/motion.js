/*
 * Overkreatif — homepage motion layer (Motion / motion.dev)
 *
 * Built into js/motion.min.js with `npm run build:motion`.
 *
 * Contract with the markup:
 *   [data-reveal="up|fade|scale|left|right|card|blur"]  element reveals when it scrolls into view
 *   [data-reveal-group]                                 direct [data-reveal] children reveal together, staggered
 *   [data-split]                                        heading split into words, masked slide-up on load
 *   [data-parallax="<px>"]                              element drifts <px> over its scroll range
 *
 * Elements are only hidden while <html> has .motion-ready (set by a tiny inline
 * script in <head>, never under prefers-reduced-motion, and removed again if this
 * file fails to load), so content is never stuck invisible.
 */
import { animate as motionAnimate, scroll, inView, hover } from "motion";
import { drawInView, rippleFactors, scramble } from "./fx.js";
import { initLightbox } from "./lightbox.js";

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
window.__motionBooted = true;

// Head fallback already gave up (slow network) or user prefers reduced motion: do nothing.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The portfolio lightbox is a feature, not decoration: it runs for everyone
// (without transitions when motion is reduced).
initLightbox({
  animate,
  reduce: reduceMotion || !root.classList.contains("motion-ready"),
  label: "Pratinjau proyek",
  openLabel: "Lihat proyek",
  cursor: "Lihat",
  items: Array.from(document.querySelectorAll("#work .card")).map((card) => ({
    trigger: card,
    img: card.querySelector("img"),
    title: (card.querySelector("h3") || {}).textContent,
    kind: (card.querySelector("h3 + p") || {}).textContent,
  })),
});

if (reduceMotion || !root.classList.contains("motion-ready")) {
  root.classList.remove("motion-ready");
} else {
  init();
}

function init() {
  const EASE = [0.22, 1, 0.36, 1]; // soft "expo-out"
  const SPRING = { type: "spring", stiffness: 380, damping: 22 };
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;

  /* ------------------------------------------------------------------ */
  /* Client logos: one slow marquee row that eases off on hover          */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-marquee]").forEach((row) => {
    const items = Array.from(row.children);
    const track = document.createElement("div");
    track.className = "logo-marquee__track";
    items.forEach((el) => track.appendChild(el));
    items.forEach((el) => {
      const copy = el.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    });
    row.appendChild(track);
    row.classList.add("logo-marquee");
    const loop = animate(track, { transform: ["translateX(0%)", "translateX(-50%)"] }, { duration: 45, repeat: Infinity, ease: "linear" });
    if (canHover) {
      row.addEventListener("pointerenter", () => (loop.speed = 0.25));
      row.addEventListener("pointerleave", () => (loop.speed = 1));
    }
  });

  /* ------------------------------------------------------------------ */
  /* "Proses Kami": pin the section and light the steps up in turn      */
  /* (desktop + tall enough screen; same media query as the CSS)        */
  /* ------------------------------------------------------------------ */
  const system = document.getElementById("system");
  const pinProcess = system && window.matchMedia("(min-width: 1024px) and (min-height: 760px)").matches;
  let processSteps = [];
  if (pinProcess) {
    system.classList.add("process-pinned");
    const stage = system.querySelector(":scope > .relative.z-10");
    if (stage) stage.classList.add("process-stage");
    const grid = system.querySelector(".show-desktop-ipadpro .grid");
    if (grid) {
      // the steps are revealed by the scroll position instead of the generic stagger
      grid.removeAttribute("data-reveal-group");
      processSteps = Array.from(grid.children);
      processSteps.forEach((s) => {
        s.removeAttribute("data-reveal");
        s.classList.add("process-step");
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reveal variants                                                     */
  /* ------------------------------------------------------------------ */
  const VARIANTS = {
    up: { opacity: [0, 1], transform: ["translateY(32px)", "translateY(0px)"] },
    fade: { opacity: [0, 1] },
    scale: { opacity: [0, 1], transform: ["translateY(24px) scale(0.96)", "translateY(0px) scale(1)"] },
    left: { opacity: [0, 1], transform: ["translateX(-32px)", "translateX(0px)"] },
    right: { opacity: [0, 1], transform: ["translateX(32px)", "translateX(0px)"] },
    blur: { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0px)"], filter: ["blur(8px)", "blur(0px)"] },
  };

  // Remove inline styles Motion commits at the end, so the page's own CSS
  // (hover lifts, transitions) takes over again exactly where we left off.
  function settle(el, props) {
    el.setAttribute("data-revealed", "");
    props.forEach((p) => el.style.removeProperty(p));
  }

  function reveal(el, delay = 0) {
    const type = el.getAttribute("data-reveal") || "up";

    if (type === "card") return revealCard(el, delay);

    const keyframes = VARIANTS[type] || VARIANTS.up;
    const props = Object.keys(keyframes);
    animate(el, keyframes, { duration: type === "fade" ? 0.9 : 0.85, delay, ease: EASE }).then(() =>
      settle(el, props.map(toCssProp))
    );
  }

  // Portfolio card: lift + image curtain (clip-path) + image settling from a slight zoom.
  function revealCard(card, delay) {
    const frame = card.firstElementChild;
    const img = frame && frame.querySelector("img");
    animate(card, VARIANTS.up, { duration: 0.9, delay, ease: EASE }).then(() =>
      settle(card, ["opacity", "transform"])
    );
    if (frame) {
      animate(
        frame,
        { clipPath: ["inset(18% 6% 0% 6% round 16px)", "inset(0% 0% 0% 0% round 16px)"] },
        { duration: 1.1, delay, ease: EASE }
      ).then(() => frame.style.removeProperty("clip-path"));
    }
    if (img) {
      animate(img, { transform: ["scale(1.18)", "scale(1)"] }, { duration: 1.4, delay, ease: EASE }).then(() =>
        img.style.removeProperty("transform")
      );
    }
  }

  function toCssProp(p) {
    return p === "clipPath" ? "clip-path" : p;
  }

  // Groups: stagger direct children when the group enters the viewport.
  const grouped = new Set();
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    const items = Array.from(group.children).filter((c) => c.hasAttribute("data-reveal"));
    items.forEach((i) => grouped.add(i));
    const step = parseFloat(group.getAttribute("data-reveal-group")) || 0.09;
    const base = parseFloat(group.getAttribute("data-reveal-delay")) || 0;
    const ripple = group.hasAttribute("data-reveal-ripple");
    const stop = inView(
      group,
      () => {
        // ripple: items closest to the grid's centre first, spreading outwards
        const f = ripple ? rippleFactors(items) : null;
        items.forEach((item, i) => reveal(item, base + (f ? f[i] * step * items.length * 0.6 : i * step)));
        stop();
      },
      { amount: 0.12, margin: "0px 0px -8% 0px" }
    );
  });

  // Singles.
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (grouped.has(el) || el.closest("[data-hero]")) return;
    const delay = parseFloat(el.getAttribute("data-reveal-delay")) || 0;
    const stop = inView(
      el,
      () => {
        reveal(el, delay);
        stop();
      },
      { amount: 0.2, margin: "0px 0px -8% 0px" }
    );
  });

  /* ------------------------------------------------------------------ */
  /* Hero intro (runs on load, not on scroll)                            */
  /* ------------------------------------------------------------------ */
  const hero = document.querySelector("[data-hero]");
  if (hero) {
    const title = hero.querySelector("[data-split]");
    let wordsEnd = 0;
    if (title) {
      const words = splitWords(title);
      words.forEach((w) => (w.style.transform = "translateY(110%)"));
      title.setAttribute("data-revealed", "");
      words.forEach((w, i) => {
        animate(w, { transform: ["translateY(110%)", "translateY(0%)"] }, { duration: 0.9, delay: 0.05 + i * 0.045, ease: EASE }).then(() => {
          w.style.removeProperty("transform");
          // Landed: stop clipping so tall glyphs are never cropped by the mask.
          if (w.parentElement) w.parentElement.style.overflow = "visible";
        });
      });
      wordsEnd = 0.05 + words.length * 0.045;
    }
    hero.querySelectorAll("[data-reveal]").forEach((el, i) => reveal(el, Math.max(0.25, wordsEnd - 0.2) + i * 0.12));

    // Hero visual: gentle settle from a slight zoom (no opacity, keeps LCP painted).
    const visual = hero.querySelector("[data-hero-visual] img");
    if (visual) {
      animate(visual, { transform: ["scale(1.06) translateY(12px)", "scale(1) translateY(0px)"] }, { duration: 1.6, ease: EASE }).then(
        () => visual.style.removeProperty("transform")
      );
    }

    // Ambient blobs drift and slowly change shape forever. Uneven scale + rotation reads as a
    // morph on these soft, blurred circles while staying compositor-only (no repaint of the blur).
    const BLOB_PATHS = [
      [
        "translate(0px, 0px) rotate(0deg) scale(1, 1)",
        "translate(46px, -28px) rotate(28deg) scale(1.18, 0.86)",
        "translate(-14px, 22px) rotate(-18deg) scale(0.9, 1.14)",
        "translate(0px, 0px) rotate(0deg) scale(1, 1)",
      ],
      [
        "translate(0px, 0px) rotate(0deg) scale(1, 1)",
        "translate(-38px, 26px) rotate(-24deg) scale(0.88, 1.16)",
        "translate(18px, -16px) rotate(16deg) scale(1.14, 0.9)",
        "translate(0px, 0px) rotate(0deg) scale(1, 1)",
      ],
    ];
    hero.querySelectorAll(".hero-blob").forEach((blob, i) => {
      animate(blob, { transform: BLOB_PATHS[i % 2] }, { duration: 16 + i * 4, repeat: Infinity, ease: "easeInOut" });
    });

    // Scroll-out parallax: copy rises a touch faster than the visual, then fades.
    if (isDesktop) {
      const copy = hero.querySelector("[data-hero-copy]");
      const visualWrap = hero.querySelector("[data-hero-visual]");
      const range = { target: hero, offset: ["start start", "end start"] };
      if (copy) scroll(animate(copy, { transform: ["translateY(0px)", "translateY(-70px)"], opacity: [1, 0.2] }, { ease: "linear" }), range);
      if (visualWrap) scroll(animate(visualWrap, { transform: ["translateY(0px)", "translateY(60px)"] }, { ease: "linear" }), range);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Generic parallax                                                    */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const dist = parseFloat(el.getAttribute("data-parallax")) || 60;
    const target = el.closest("section") || el.parentElement;
    scroll(
      animate(el, { transform: [`translateY(${-dist}px)`, `translateY(${dist}px)`] }, { ease: "linear" }),
      { target, offset: ["start end", "end start"] }
    );
  });

  /* ------------------------------------------------------------------ */
  /* Process section: line drawing + floating step icons                 */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-draw-x]").forEach((line) => {
    // Pinned: the whole (tall) section is the scroll range and the line is full at 80%, so the
    // last step gets a moment on screen before the section scrolls away.
    const FULL_AT = 0.8;
    const range = pinProcess
      ? { target: system, offset: ["start start", "end end"] }
      : { target: line.parentElement, offset: ["start 85%", "end 55%"] };
    scroll(
      animate(line, { transform: pinProcess ? ["scaleX(0)", "scaleX(1)", "scaleX(1)"] : ["scaleX(0)", "scaleX(1)"] },
        pinProcess ? { ease: "linear", times: [0, FULL_AT, 1] } : { ease: "linear" }),
      range
    );

    // Light up each step box once the line reaches it (boxes sit at 0, 1/4 … 1 of the line).
    const boxes = Array.from(line.parentElement.querySelectorAll(".process-step-box"));
    if (boxes.length > 1) {
      const last = boxes.length - 1;
      scroll((progress) => {
        const p = pinProcess ? Math.min(1, progress / FULL_AT) : progress;
        // Light up as the line touches the box edge (half a box before its centre).
        const edge = boxes[0].offsetWidth / 2 / (line.offsetWidth || 1);
        boxes.forEach((box, i) => {
          const on = p >= i / last - edge;
          box.classList.toggle("is-active", on);
          if (processSteps[i]) processSteps[i].classList.toggle("is-active", on);
        });
      }, range);
    }
  });
  document.querySelectorAll("[data-draw-y]").forEach((line) => {
    // Span the fill from the first dot's centre to the last dot's centre, like the rail itself.
    const dots = Array.from(line.parentElement.querySelectorAll(":scope > .relative > .absolute.rounded-full"));
    if (dots.length > 1) {
      const centre = (d) => d.offsetParent.offsetTop + d.offsetTop + d.offsetHeight / 2;
      const place = () => {
        // this rail is display:none at some widths (no offsetParent): nothing to measure then
        if (!dots[0].offsetParent || !dots[dots.length - 1].offsetParent) return;
        const top = centre(dots[0]);
        line.style.top = top + "px";
        line.style.bottom = "auto";
        line.style.height = Math.max(0, centre(dots[dots.length - 1]) - top) + "px";
      };
      place();
      window.addEventListener("resize", place);
    }
    scroll(animate(line, { transform: ["scaleY(0)", "scaleY(1)"] }, { ease: "linear" }), {
      target: line.parentElement,
      offset: ["start 75%", "end 60%"],
    });
  });
  document.querySelectorAll("[data-float]").forEach((el, i) => {
    animate(el, { transform: ["translateY(0px)", "translateY(-6px)"] }, {
      duration: 2.6,
      delay: i * 0.35,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    });
  });

  /* ------------------------------------------------------------------ */
  /* Icons draw their strokes when they come into view                   */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll(".poin-service svg.icon, #about svg.icon, #system svg.icon").forEach((svg) => {
    // icons in the layout that is hidden at this width (desktop vs mobile timeline) stay as they are
    if (!svg.getClientRects().length) return;
    drawInView(svg, { delay: 0.3, duration: 1.1 });
  });

  /* ------------------------------------------------------------------ */
  /* Eyebrow labels decode from random letters                          */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-scramble]").forEach((el) => {
    const stop = inView(
      el,
      () => {
        scramble(el, { delay: 0.15, duration: 0.9 });
        stop();
      },
      { amount: 0.6 }
    );
  });

  // "How we think" bullets: soft breathing dot.
  document.querySelectorAll(".circle-how-think svg").forEach((dot, i) => {
    animate(dot, { transform: ["scale(1)", "scale(1.45)"], opacity: [1, 0.55] }, {
      duration: 1.8,
      delay: i * 0.4,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    });
  });

  /* ------------------------------------------------------------------ */
  /* Micro-interactions (mouse only)                                     */
  /* ------------------------------------------------------------------ */
  if (canHover) {
    // Service cards: icon badge springs and tilts.
    hover(".poin-service", (card) => {
      const icon = card.querySelector(".rounded-full");
      if (!icon) return;
      animate(icon, { transform: "scale(1.12) rotate(-10deg)" }, SPRING);
      return () => animate(icon, { transform: "scale(1) rotate(0deg)" }, SPRING);
    });

    // About bento + FAQ items: tiny lift.
    hover("#about [data-reveal], #faq details", (el) => {
      if (!el.hasAttribute("data-revealed")) return;
      animate(el, { transform: "translateY(-4px)" }, SPRING);
      return () => animate(el, { transform: "translateY(0px)" }, SPRING).then(() => el.style.removeProperty("transform"));
    });

    // Magnetic primary CTAs: follow the cursor a few pixels.
    document.querySelectorAll("[data-magnetic]").forEach((btn) => {
      const strength = 0.25;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        animate(btn, { transform: `translate(${x}px, ${y}px)` }, { duration: 0.3, ease: EASE });
      });
      btn.addEventListener("pointerleave", () => {
        animate(btn, { transform: "translate(0px, 0px)" }, SPRING).then(() => btn.style.removeProperty("transform"));
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Header: soft shadow once the page scrolls                           */
  /* ------------------------------------------------------------------ */
  const headers = document.querySelectorAll("header.sticky");
  scroll((progress, info) => {
    const scrolled = info.y.current > 12;
    headers.forEach((h) => h.classList.toggle("is-scrolled", scrolled));
  });
}

/* Split text nodes into masked words while keeping inline elements (e.g. coloured spans). */
function splitWords(node) {
  const out = [];
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
          return;
        }
        const mask = document.createElement("span");
        mask.className = "split-mask";
        const inner = document.createElement("span");
        inner.className = "split-word";
        inner.textContent = part;
        mask.appendChild(inner);
        frag.appendChild(mask);
        out.push(inner);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      out.push(...splitWords(child));
    }
  });
  return out;
}
