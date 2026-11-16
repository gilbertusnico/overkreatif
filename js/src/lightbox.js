/*
 * Portfolio lightbox for the homepage (#work .card) + a "Lihat" cursor bubble.
 * Works with reduced motion too (no transitions, no cursor bubble).
 * Keyboard: Enter/Space opens a card, ←/→ switch projects, Esc closes, Tab stays inside.
 */
const EASE = [0.22, 1, 0.36, 1];

export function initLightbox({ animate, reduce }) {
  const cards = Array.from(document.querySelectorAll("#work .card"));
  if (!cards.length) return;

  const items = cards.map((card) => {
    const img = card.querySelector("img");
    return {
      card,
      img,
      title: (card.querySelector("h3") || {}).textContent || "",
      kind: (card.querySelector("h3 + p") || {}).textContent || "",
    };
  });

  /* ---- markup ---- */
  const icon = (d) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Pratinjau proyek");
  lb.hidden = true;
  lb.innerHTML = `
    <div class="lb__backdrop" data-lb-close></div>
    <figure class="lb__figure">
      <img class="lb__img" alt="" />
      <figcaption class="lb__cap"><strong class="lb__title"></strong><span class="lb__kind"></span><span class="lb__count"></span></figcaption>
    </figure>
    <button type="button" class="lb__btn lb__close" data-lb-close aria-label="Tutup pratinjau">${icon("M18 6 6 18M6 6l12 12")}</button>
    <button type="button" class="lb__btn lb__prev" aria-label="Proyek sebelumnya">${icon("m15 18-6-6 6-6")}</button>
    <button type="button" class="lb__btn lb__next" aria-label="Proyek berikutnya">${icon("m9 18 6-6-6-6")}</button>`;
  document.body.appendChild(lb);

  const figure = lb.querySelector(".lb__figure");
  const bigImg = lb.querySelector(".lb__img");
  const title = lb.querySelector(".lb__title");
  const kind = lb.querySelector(".lb__kind");
  const count = lb.querySelector(".lb__count");
  const buttons = Array.from(lb.querySelectorAll("button"));

  let current = -1;
  let opener = null;

  function show(i) {
    current = (i + items.length) % items.length;
    const it = items[current];
    bigImg.src = it.img.currentSrc || it.img.src;
    bigImg.alt = it.img.alt;
    // never upscale past the file's own width
    bigImg.style.maxWidth = `min(100%, ${it.img.naturalWidth || parseInt(it.img.getAttribute("width"), 10) || 840}px)`;
    title.textContent = it.title;
    kind.textContent = it.kind;
    count.textContent = `${current + 1} / ${items.length}`;
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
      // keep focus on the dialog's buttons
      const i = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });

  /* ---- cards become buttons ---- */
  items.forEach((it, i) => {
    it.card.setAttribute("role", "button");
    it.card.setAttribute("tabindex", "0");
    it.card.setAttribute("aria-label", `Lihat proyek ${it.title}`);
    it.card.classList.add("is-clickable");
    it.card.addEventListener("click", () => open(i));
    it.card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(i);
      }
    });
  });

  /* ---- "Lihat" cursor bubble (mouse only, motion allowed) ---- */
  if (reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const bubble = document.createElement("div");
  bubble.className = "lb-cursor";
  bubble.setAttribute("aria-hidden", "true");
  bubble.textContent = "Lihat";
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
