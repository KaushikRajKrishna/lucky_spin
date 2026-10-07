/* =========================================================
   FESTIVE LUCKY SPIN — settings you can edit
   ========================================================= */
const CONFIG = {
  shopName: "MAA DURGA MOBILE HOUSE",  // shown at the top of the page
  spinDuration: 6500,            // ms the wheel spins
  minFullTurns: 6,               // full rotations before stopping
  oneSpinPerDevice: false,       // true = each phone/browser can spin only once
  sound: true,
};

/*
  PRIZES — the order here is the order on the wheel (clockwise from the top).
  `weight` = chance of winning. Weights are relative: an item with 30 is
  30x more likely than an item with 1. Weight 0 = shown on the wheel but can NEVER be won.
  `label` is what's printed on the wheel ("\n" = line break).
*/
const PRIZES = [
  { name: "Smart Phone",    label: "Smart\nPhone",    icon: "📱", weight: 0,  color: "#7b1fa2" },
  { name: "Tempered Glass", label: "Tempered\nGlass", icon: "🛡️", weight: 30, color: "#e0123a" },
  { name: "Headphones",     label: "Headphones",      icon: "🎧", weight: 1,  color: "#1e88e5" },
  { name: "Mobile Cover",   label: "Mobile\nCover",   icon: "📲", weight: 16, color: "#f57c00" },
  { name: "OTG Adapter",    label: "OTG",             icon: "🔌", weight: 8,  color: "#2e9e3e" },
  { name: "Earbuds",        label: "Earbuds",         icon: "🎵", weight: 20, color: "#e91e8c" },
  { name: "Charger",        label: "Charger",         icon: "⚡", weight: 13, color: "#00a0a8" },
];

/* =========================================================
   Below this line you don't need to change anything
   ========================================================= */
const STORAGE_KEY = "festiveLuckySpin.result";

const $ = (id) => document.getElementById(id);
const wheelWrap = $("wheelWrap");
const canvas = $("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = $("spinBtn");
const pointer = $("pointer");
const hint = $("hint");
const modal = $("modal");

const SEG = PRIZES.length;
const SEG_DEG = 360 / SEG;

let rotation = 0;   // current wheel rotation in degrees (cumulative)
let spinning = false;

/* ---------- Helpers ---------- */
function rand() {
  if (window.crypto && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }
  return Math.random();
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (pct < 0 ? c : 255 - c) * pct)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function safeStorage(fn) {
  try { return fn(window.localStorage); } catch (e) { return null; }
}

/* ---------- Weighted (biased) prize picking ---------- */
function pickPrizeIndex() {
  const total = PRIZES.reduce((s, p) => s + Math.max(0, p.weight), 0);
  if (total <= 0) return 0;
  let r = rand() * total;
  for (let i = 0; i < SEG; i++) {
    const w = Math.max(0, PRIZES[i].weight);
    if (w === 0) continue;
    if (r < w) return i;
    r -= w;
  }
  // floating-point fallback: last item with weight > 0
  for (let i = SEG - 1; i >= 0; i--) if (PRIZES[i].weight > 0) return i;
  return 0;
}

/* ---------- Draw the wheel ---------- */
function drawWheel() {
  const size = canvas.clientWidth;
  if (!size) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const r = size / 2;
  const arc = (Math.PI * 2) / SEG;
  ctx.clearRect(0, 0, size, size);

  // Slices
  for (let i = 0; i < SEG; i++) {
    const start = -Math.PI / 2 + i * arc;
    const p = PRIZES[i];
    const g = ctx.createRadialGradient(r, r, r * 0.15, r, r, r);
    g.addColorStop(0, shade(p.color, -0.35));
    g.addColorStop(0.55, p.color);
    g.addColorStop(1, shade(p.color, 0.18));
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Gold dividers
  ctx.lineWidth = Math.max(2, size * 0.008);
  ctx.strokeStyle = "#ffc21a";
  for (let i = 0; i < SEG; i++) {
    const a = -Math.PI / 2 + i * arc;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r);
    ctx.stroke();
  }

  // Labels: one common font size so the wheel looks uniform
  const textStart = r * 0.50;
  const textEnd = r * 0.91;
  const maxW = textEnd - textStart;
  let fs = r * 0.12;
  const font = (s) => `800 ${s}px Poppins, system-ui, sans-serif`;
  const allLines = PRIZES.flatMap((p) => p.label.split("\n"));
  ctx.font = font(fs);
  while (fs > 8 && allLines.some((l) => ctx.measureText(l).width > maxW)) {
    fs -= 0.5;
    ctx.font = font(fs);
  }

  for (let i = 0; i < SEG; i++) {
    const p = PRIZES[i];
    const mid = -Math.PI / 2 + i * arc + arc / 2;
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(mid);

    // Icon (just outside the centre button)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${r * 0.12}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.save();
    ctx.translate(r * 0.40, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(p.icon, 0, 0);
    ctx.restore();

    // Name
    const lines = p.label.split("\n");
    ctx.font = font(fs);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1.5;
    const lh = fs * 1.05;
    lines.forEach((line, k) => {
      const y = (k - (lines.length - 1) / 2) * lh;
      ctx.fillText(line, textEnd, y);
    });
    ctx.restore();
  }

  // Pegs on the edge at each divider
  for (let i = 0; i < SEG; i++) {
    const a = -Math.PI / 2 + i * arc;
    const px = r + Math.cos(a) * r * 0.955;
    const py = r + Math.sin(a) * r * 0.955;
    const pg = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, r * 0.03);
    pg.addColorStop(0, "#fffbe0");
    pg.addColorStop(1, "#d88a00");
    ctx.beginPath();
    ctx.arc(px, py, r * 0.028, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
  }

  // Depth: dark edge vignette + soft gloss
  const v = ctx.createRadialGradient(r, r, r * 0.7, r, r, r);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.28)");
  ctx.fillStyle = v;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  const gloss = ctx.createLinearGradient(0, 0, 0, size);
  gloss.addColorStop(0, "rgba(255,255,255,.16)");
  gloss.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fill();
}

/* ---------- Decorations ---------- */
function buildBulbs() {
  const count = 20;
  const box = $("bulbs");
  box.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const b = document.createElement("i");
    b.style.setProperty("--a", `${(360 / count) * i}deg`);
    box.appendChild(b);
  }
}

function buildStars() {
  const box = $("stars");
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("i");
    s.style.left = `${rand() * 100}%`;
    s.style.top = `${rand() * 100}%`;
    s.style.animationDelay = `${rand() * 3}s`;
    s.style.animationDuration = `${2 + rand() * 3}s`;
    box.appendChild(s);
  }
}

function buildChips() {
  const ul = $("chips");
  ul.innerHTML = PRIZES.map(
    (p) => `<li><span class="dot" style="background:${p.color}"></span>${p.icon} ${p.name}</li>`
  ).join("");
}

/* ---------- Sound (Web Audio, no files needed) ---------- */
let audio = null;
function initAudio() {
  if (!CONFIG.sound || audio) return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { audio = null; }
}
function beep(freq, dur, type = "square", vol = 0.05, when = 0) {
  if (!audio) return;
  const t = audio.currentTime + when;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const tickSound = () => beep(1400, 0.035, "square", 0.03);
function winSound() {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.25, "triangle", 0.12, i * 0.11));
  beep(1319, 0.5, "triangle", 0.1, 0.48);
}

/* ---------- Spin ---------- */
function easeOut(t) {
  return 1 - Math.pow(1 - t, 4);
}

function spin() {
  if (spinning) return;
  initAudio();
  if (audio && audio.state === "suspended") audio.resume();

  const index = pickPrizeIndex();

  // Angle (from the top, clockwise) on the wheel where it should stop — random spot inside the slice
  const landAt = index * SEG_DEG + SEG_DEG * (0.18 + rand() * 0.64);
  const currentMod = ((rotation % 360) + 360) % 360;
  const targetMod = (360 - landAt) % 360;
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  const from = rotation;
  const to = rotation + CONFIG.minFullTurns * 360 + delta;

  spinning = true;
  spinBtn.disabled = true;
  wheelWrap.classList.add("spinning");
  hint.textContent = "Spinning… good luck! 🍀";

  const startTime = performance.now();
  let lastSeg = Math.floor(from / SEG_DEG);

  function frame(now) {
    const t = Math.min(1, (now - startTime) / CONFIG.spinDuration);
    rotation = from + (to - from) * easeOut(t);
    canvas.style.transform = `rotate(${rotation}deg)`;

    const seg = Math.floor(rotation / SEG_DEG);
    if (seg !== lastSeg) {
      lastSeg = seg;
      tickSound();
      pointer.classList.remove("tick");
      void pointer.offsetWidth; // restart animation
      pointer.classList.add("tick");
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation = to;
      finish(index);
    }
  }
  requestAnimationFrame(frame);
}

function finish(index) {
  spinning = false;
  wheelWrap.classList.remove("spinning");
  const prize = PRIZES[index];

  const result = { index };

  if (CONFIG.oneSpinPerDevice) {
    safeStorage((s) => s.setItem(STORAGE_KEY, JSON.stringify(result)));
    lockAfterSpin(prize);
  } else {
    spinBtn.disabled = false;
    hint.innerHTML = `You won <b>${prize.name}</b>! Tap <b>SPIN NOW</b> to play again`;
  }

  setTimeout(() => {
    winSound();
    showResult(prize);
  }, 350);
}

function lockAfterSpin(prize) {
  spinBtn.disabled = true;
  hint.innerHTML = `You already won <b>${prize.name}</b> 🎉 <a href="#" id="showAgain" style="color:#ffc21a">View prize</a>`;
  const link = $("showAgain");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const saved = safeStorage((s) => JSON.parse(s.getItem(STORAGE_KEY)));
      if (saved && PRIZES[saved.index]) showResult(PRIZES[saved.index], false);
    });
  }
}

/* ---------- Popup ---------- */
let lastFocus = null;
function showResult(prize, celebrate = true) {
  $("prizeIcon").textContent = prize.icon;
  $("prizeName").textContent = prize.name;
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".modal-btn").focus();
  if (celebrate) confetti();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ---------- Confetti ---------- */
function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("confetti");
  const cx = c.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ["#ffc21a", "#ff3b5c", "#2ecc71", "#3fa9f5", "#b84dff", "#ff8a00", "#ffffff"];
  const pieces = Array.from({ length: Math.min(180, Math.round(W / 2.5)) }, () => ({
    x: W / 2 + (rand() - 0.5) * 60,
    y: H * 0.45,
    vx: (rand() - 0.5) * 16,
    vy: -rand() * 16 - 6,
    w: 6 + rand() * 6,
    h: 8 + rand() * 8,
    rot: rand() * Math.PI,
    vr: (rand() - 0.5) * 0.4,
    color: colors[Math.floor(rand() * colors.length)],
  }));

  const start = performance.now();
  function draw(now) {
    const elapsed = now - start;
    cx.clearRect(0, 0, W, H);
    pieces.forEach((p) => {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      cx.save();
      cx.globalAlpha = Math.max(0, 1 - elapsed / 3500);
      cx.translate(p.x, p.y);
      cx.rotate(p.rot);
      cx.fillStyle = p.color;
      cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      cx.restore();
    });
    if (elapsed < 3500) requestAnimationFrame(draw);
    else cx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(draw);
}

/* ---------- Init ---------- */
function init() {
  $("shopName").textContent = CONFIG.shopName;
  buildBulbs();
  buildStars();
  buildChips();
  drawWheel();

  // Redraw crisp on resize / rotation, and once the Poppins font has loaded
  if ("ResizeObserver" in window) {
    let last = 0;
    new ResizeObserver(() => {
      const w = canvas.clientWidth;
      if (w !== last) { last = w; drawWheel(); }
    }).observe(canvas);
  } else {
    window.addEventListener("resize", drawWheel);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWheel);

  spinBtn.addEventListener("click", spin);

  if (CONFIG.oneSpinPerDevice) {
    const saved = safeStorage((s) => JSON.parse(s.getItem(STORAGE_KEY)));
    if (saved && PRIZES[saved.index]) {
      // show the wheel resting on the prize they already won
      rotation = (360 - (saved.index * SEG_DEG + SEG_DEG / 2)) % 360;
      canvas.style.transform = `rotate(${rotation}deg)`;
      lockAfterSpin(PRIZES[saved.index]);
    }
  }
}

init();
