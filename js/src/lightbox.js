/*
 * Image lightbox shared by the homepage (portfolio cards) and the product pages (screenshots).
 * Works with reduced motion too (no transitions, no cursor bubble).
 * Keyboard: Enter/Space opens, ←/→ switch, Esc closes, Tab stays inside.
 *
 * items: [{ trigger, img, src?, title, kind? }]
 *   trigger  element that opens the lightbox (made focusable, role=button)
 *   img      the thumbnail <img> (alt text and fallback source)
 *   src      optional larger file to show; string or () => string
 *   title    string or () => string (read when opened)
 */
const EASE = [0.22, 1, 0.36, 1];
const val = (v) => (typeof v === "function" ? v() : v) || "";

const CSS = `
  .lb-trigger{cursor:pointer}
  .lb-trigger.lb-zoom{cursor:zoom-in}
  .lb-trigger:focus-visible{outline:2px solid var(--lb-accent,#003ec7);outline-offset:6px;border-radius:1rem}
  .lb{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:4.5rem 1rem 1.5rem}
  .lb[hidden]{display:none}
  .lb__backdrop{position:absolute;inset:0;background:rgba(9,11,18,.84);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .lb__figure{position:relative;margin:0;display:flex;flex-direction:column;align-items:center;gap:.9rem;width:min(94vw,var(--lb-width,1100px))}
  .lb__img{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100vh - 11rem);border-radius:1rem;box-shadow:0 30px 80px -20px rgba(0,0,0,.6);background:#fff}
  .lb__cap{display:flex;flex-wrap:wrap;gap:.25rem .75rem;align-items:baseline;justify-content:center;color:#fff;text-align:center;font-family:inherit}
  .lb__title{font-size:1.15rem;font-weight:800}
  .lb__kind{color:rgba(255,255,255,.72)}
  .lb__count{color:rgba(255,255,255,.6);font-size:.85rem}
  .lb__btn{position:absolute;z-index:1;display:grid;place-items:center;width:3rem;height:3rem;padding:0;border-radius:999px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);cursor:pointer;transition:background-color .2s ease}
  .lb__btn:hover{background:rgba(255,255,255,.22)}
  .lb__btn:focus-visible{outline:2px solid #fff;outline-offset:3px}
  .lb__close{top:1rem;right:1rem}
  .lb__prev,.lb__next{top:50%;margin-top:-1.5rem}
  .lb__prev{left:1rem}
  .lb__next{right:1rem}
  @media (max-width:640px){
    .lb{padding-bottom:5.5rem}
    .lb__prev,.lb__next{top:auto;bottom:1.25rem;margin-top:0}
    .lb__prev{left:calc(50% - 3.5rem)}
    .lb__next{right:calc(50% - 3.5rem)}
  }
  .lb-cursor{position:fixed;left:0;top:0;z-index:90;width:84px;height:84px;border-radius:999px;display:grid;place-items:center;
    background:var(--lb-accent,#0052ff);color:#fff;font-weight:800;font-size:.9rem;pointer-events:none;
    transform:translate(-200px,-200px) scale(0);box-shadow:0 12px 30px -8px rgba(0,0,0,.35)}
`;

export function initLightbox({ animate, reduce, items, label = "Pratinjau gambar", openLabel = "Lihat", cursor = false, zoom = false, width }) {
  if (!items || !items.length) return;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ---- markup ---- */
  const icon = (d) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", label);
  if (width) lb.style.setProperty("--lb-width", width);
  lb.hidden = true;
  lb.innerHTML = `
    <div class="lb__backdrop" data-lb-close></div>
    <figure class="lb__figure">
      <img class="lb__img" alt="" />
      <figcaption class="lb__cap"><strong class="lb__title"></strong><span class="lb__kind"></span><span class="lb__count"></span></figcaption>
    </figure>
    <button type="button" class="lb__btn lb__close" data-lb-close aria-label="Tutup">${icon("M18 6 6 18M6 6l12 12")}</button>
    <button type="button" class="lb__btn lb__prev" aria-label="Sebelumnya">${icon("m15 18-6-6 6-6")}</button>
    <button type="button" class="lb__btn lb__next" aria-label="Berikutnya">${icon("m9 18 6-6-6-6")}</button>`;
  document.body.appendChild(lb);

  const figure = lb.querySelector(".lb__figure");
  const bigImg = lb.querySelector(".lb__img");
  const title = lb.querySelector(".lb__title");
  const kind = lb.querySelector(".lb__kind");
  const count = lb.querySelector(".lb__count");
  const buttons = Array.from(lb.querySelectorAll("button"));
  if (items.length < 2) lb.querySelectorAll(".lb__prev, .lb__next").forEach((b) => (b.hidden = true));

  let current = -1;
  let opener = null;

  function show(i) {
    current = (i + items.length) % items.length;
    const it = items[current];
    // show the thumbnail at once, then swap to the larger file when one is given
    const small = it.img.currentSrc || it.img.src;
    const big = val(it.src);
    bigImg.removeAttribute("width");
    bigImg.removeAttribute("height");
    bigImg.src = big || small;
    bigImg.alt = it.img.alt;
    title.textContent = val(it.title);
    kind.textContent = val(it.kind);
    count.textContent = items.length > 1 ? `${current + 1} / ${items.length}` : "";
  }

  function open(i) {
    opener = document.activeElement;
    show(i);
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    if (sbw) document.body.style.paddingRight = sbw + "px";
    lb.hidden = false;
    lb.querySelector(".lb__close").focus({ preventScroll: true });
    if (!reduce) {
      animate(lb.querySelector(".lb__backdrop"), { opacity: [0, 1] }, { duration: 0.3 });
      animate(figure, { opacity: [0, 1], transform: ["translateY(16px) scale(0.97)", "translateY(0px) scale(1)"] }, { duration: 0.45, ease: EASE });
      animate(lb.querySelectorAll(".lb__btn"), { opacity: [0, 1] }, { duration: 0.3, delay: 0.1 });
    }
  }

  function close() {
    if (lb.hidden) return;
    const done = () => {
      lb.hidden = true;
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
    if (reduce) return done();
    animate(lb.querySelector(".lb__backdrop"), { opacity: 0 }, { duration: 0.2 });
    animate(lb.querySelectorAll(".lb__btn"), { opacity: 0 }, { duration: 0.15 });
    animate(figure, { opacity: 0, transform: "translateY(10px) scale(0.98)" }, { duration: 0.2 }).then(done);
  }

  function step(dir) {
    if (items.length < 2) return;
    if (reduce) return show(current + dir);
    animate(figure, { opacity: 0, transform: `translateX(${-dir * 24}px)` }, { duration: 0.15 }).then(() => {
      show(current + dir);
      animate(figure, { opacity: [0, 1], transform: [`translateX(${dir * 24}px)`, "translateX(0px)"] }, { duration: 0.3, ease: EASE });
    });
  }

  lb.addEventListener("click", (e) => {
    if (e.target.closest("[data-lb-close]")) close();
    else if (e.target.closest(".lb__prev")) step(-1);
    else if (e.target.closest(".lb__next")) step(1);
  });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      // keep focus on the dialog's (visible) buttons
      const live = buttons.filter((b) => !b.hidden);
      const i = live.indexOf(document.activeElement);
      e.preventDefault();
      live[(i + (e.shiftKey ? -1 : 1) + live.length) % live.length].focus();
    }
  });

  /* ---- triggers become buttons ---- */
  items.forEach((it, i) => {
    const t = it.trigger;
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("aria-label", `${openLabel} ${val(it.title)}`.trim());
    t.classList.add("lb-trigger");
    if (zoom) t.classList.add("lb-zoom");
    t.addEventListener("click", (e) => {
      // links inside a trigger keep working
      if (e.target.closest("a")) return;
      open(i);
    });
    t.addEventListener("keydown", (e) => {
      if (e.target !== t) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(i);
      }
    });
  });

  /* ---- cursor bubble (mouse only, motion allowed) ---- */
  if (!cursor || reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const bubble = document.createElement("div");
  bubble.className = "lb-cursor";
  bubble.setAttribute("aria-hidden", "true");
  bubble.textContent = cursor;
  document.body.appendChild(bubble);
  let visible = false;
  const place = (e, instant) =>
    animate(bubble, { transform: `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%) scale(${visible ? 1 : 0})` }, { duration: instant ? 0 : 0.35, ease: EASE });

  items.forEach((it) => {
    const frame = it.img.parentElement;
    frame.addEventListener("pointerenter", (e) => {
      // jump (hidden) to the pointer first, then grow in place
      visible = false;
      place(e, true);
      visible = true;
      place(e, false);
    });
    frame.addEventListener("pointermove", (e) => place(e, false));
    frame.addEventListener("pointerleave", (e) => {
      visible = false;
      place(e, false);
    });
  });
}
