(() => {
  /* ---------------- Config ---------------- */
  // RSVPs open WhatsApp with a pre-filled message to this number
  // (country code + number, digits only). Leave empty to just show a thank-you.
  const RSVP_WHATSAPP = "";
  // Countdown target: Poruwa ceremony, Sri Lanka time
  const WEDDING_DATE = new Date("2027-01-19T09:47:00+05:30");

  const FRAME_COUNT = 121;
  const frameSrc = (i) => `Images/frames/frame_${String(i + 1).padStart(3, "0")}.webp`;

  /* ---------------- Scroll-driven video ---------------- */
  const intro = document.getElementById("intro");
  const canvas = document.getElementById("introCanvas");
  const ctx = canvas.getContext("2d");
  const bg = document.getElementById("introBg");
  const bgCtx = bg.getContext("2d");
  const hint = document.getElementById("introHint");
  const loader = document.getElementById("loader");
  const loaderBar = document.getElementById("loaderBar");

  const frames = new Array(FRAME_COUNT);
  const ready = new Array(FRAME_COUNT).fill(false);

  // Load coarse frames first (every 8th), then fill in the gaps,
  // so scrubbing works almost immediately and gets smoother as it loads.
  const order = [];
  const seen = new Set();
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < FRAME_COUNT; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
  }
  if (!seen.has(FRAME_COUNT - 1)) order.splice(1, 0, FRAME_COUNT - 1);
  const firstPass = Math.ceil(FRAME_COUNT / 8);

  let loadedCount = 0;
  let queue = 0;
  const CONCURRENCY = 6;

  function loadNext() {
    if (queue >= order.length) return;
    const i = order[queue++];
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => {
      if (img.naturalWidth) { frames[i] = img; ready[i] = true; }
      loadedCount++;
      if (loadedCount <= firstPass) loaderBar.style.width = (loadedCount / firstPass) * 100 + "%";
      if (loadedCount === 1 || i === Math.round(current)) needsDraw = true;
      if (loadedCount === firstPass) loader.classList.add("is-done");
      loadNext();
    };
    img.src = frameSrc(i);
  }
  for (let k = 0; k < CONCURRENCY; k++) loadNext();
  // Never trap the guest behind the loader
  setTimeout(() => loader.classList.add("is-done"), 6000);

  function nearestReady(i) {
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < FRAME_COUNT && ready[i + d]) return i + d;
    }
    return -1;
  }

  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    // background stays tiny: stretching + CSS blur gives a soft fill
    bg.width = 48; bg.height = Math.max(1, Math.round(48 * vh / vw));
    needsDraw = true;
  }

  function drawFrame(idx) {
    const f = nearestReady(idx);
    if (f < 0) return;
    const img = frames[f];
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const cw = canvas.width, ch = canvas.height;

    // Portrait video: fill the screen on phones, fit to height on wide screens.
    const coverScale = Math.max(cw / iw, ch / ih);
    const containScale = Math.min(cw / iw, ch / ih);
    const wide = (vw / vh) > (iw / ih) * 1.2;
    const s = wide ? containScale : coverScale;
    const w = iw * s, h = ih * s;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);

    if (wide) {
      const bs = Math.max(bg.width / iw, bg.height / ih);
      bgCtx.drawImage(img, (bg.width - iw * bs) / 2, (bg.height - ih * bs) / 2, iw * bs, ih * bs);
    }
    bg.style.display = wide ? "block" : "none";
  }

  let target = 0, current = 0, drawn = -1, needsDraw = true;

  function readScroll() {
    const start = intro.offsetTop;
    const dist = intro.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, (window.scrollY - start) / dist));
    target = p * (FRAME_COUNT - 1);
    hint.classList.toggle("is-hidden", p > 0.02);
  }

  function tick() {
    // ease toward the scroll position for a buttery scrub
    current += (target - current) * 0.18;
    if (Math.abs(target - current) < 0.01) current = target;
    const idx = Math.round(current);
    if (idx !== drawn || needsDraw) {
      drawFrame(idx);
      drawn = idx; needsDraw = false;
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", () => { resize(); readScroll(); });
  resize(); readScroll(); current = target;
  requestAnimationFrame(tick);

  /* ---------------- Reveal on scroll ---------------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------------- Countdown ---------------- */
  const units = {};
  document.querySelectorAll("#count [data-u]").forEach((el) => (units[el.dataset.u] = el));
  const pad = (n) => String(n).padStart(2, "0");
  let countTimer;
  function updateCount() {
    let diff = Math.max(0, WEDDING_DATE - Date.now()) / 1000;
    const d = Math.floor(diff / 86400); diff -= d * 86400;
    const h = Math.floor(diff / 3600); diff -= h * 3600;
    const m = Math.floor(diff / 60);
    const s = Math.floor(diff - m * 60);
    units.d.textContent = d; units.h.textContent = pad(h);
    units.m.textContent = pad(m); units.s.textContent = pad(s);
    if (d + h + m + s === 0) {
      document.getElementById("countDone").hidden = false;
      clearInterval(countTimer);
    }
  }
  updateCount();
  countTimer = setInterval(updateCount, 1000);

  /* ---------------- RSVP ---------------- */
  const form = document.getElementById("rsvpForm");
  const msg = document.getElementById("rsvpMsg");
  const attendingOnly = document.getElementById("attendingOnly");
  const guestsInput = form.elements.guests;
  const [minusBtn, plusBtn] = form.querySelectorAll(".stepper button");
  const MIN_GUESTS = 1, MAX_GUESTS = 10;

  // Disabling the fieldset hides it (CSS) and leaves its fields out of the RSVP
  function syncAttending() {
    attendingOnly.disabled = form.elements.attending.value !== "Yes, with pleasure";
  }
  form.addEventListener("change", (e) => { if (e.target.name === "attending") syncAttending(); });

  function setGuests(n) {
    n = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, Math.round(Number(n)) || MIN_GUESTS));
    guestsInput.value = n;
    minusBtn.disabled = n <= MIN_GUESTS;
    plusBtn.disabled = n >= MAX_GUESTS;
  }
  minusBtn.addEventListener("click", () => setGuests(Number(guestsInput.value) - 1));
  plusBtn.addEventListener("click", () => setGuests(Number(guestsInput.value) + 1));
  guestsInput.addEventListener("change", () => setGuests(guestsInput.value));

  // reset fires before values are restored, so re-sync afterwards
  form.addEventListener("reset", () => setTimeout(() => { syncAttending(); setGuests(guestsInput.value); }));
  syncAttending(); setGuests(guestsInput.value);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const nameInput = form.elements.name;
    if (!name) {
      nameInput.classList.add("is-invalid"); nameInput.focus();
      msg.textContent = "Please tell us your name.";
      return;
    }
    nameInput.classList.remove("is-invalid");
    const attending = data.get("attending");
    const accepted = attending === "Yes, with pleasure";
    const drinks = data.getAll("drinks");

    if (RSVP_WHATSAPP) {
      const text = `RSVP – Dinuka & Tharushi\nName: ${name}\n${attending}` +
        (accepted ? `\nGuests: ${data.get("guests")}` : "") +
        (drinks.length ? `\nDrinks: ${drinks.join(", ")}` : "");
      window.open(`https://wa.me/${RSVP_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
    msg.textContent = accepted
      ? `Thank you, ${name}! We can't wait to celebrate with you.`
      : `Thank you, ${name}. You'll be missed, and we'll be thinking of you.`;
    form.reset();
  });
})();
