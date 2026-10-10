'use strict';

/* =========================================================================
   XAZINA QUVG'U (Treasure Chase)
   Brauzer uchun arcade-platformer: har bosqich tasodifiy yaratiladi,
   qimmatbaho toshlar yig'iladi, dushmanlar va bosslar bor.
   ========================================================================= */

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const W = 960, H = 540;

/* ------------------------- yordamchi funksiyalar ------------------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------- kiritish ------------------------------- */
const keys = Object.create(null);
const pressed = Object.create(null);
const PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

addEventListener('keydown', (e) => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (PREVENT.includes(e.code)) e.preventDefault();
  initAudio();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* --- sichqoncha / sensor kiritish --- */
const mouse = { x: W / 2, y: H / 2, clicked: false };

function syncMouse(cx, cy) {
  if (typeof cvs.getBoundingClientRect !== 'function') return;
  const r = cvs.getBoundingClientRect();
  if (!r || !r.width) return;
  mouse.x = (cx - r.left) * (W / r.width);
  mouse.y = (cy - r.top) * (H / r.height);
}

if (typeof cvs.addEventListener === 'function') {
  cvs.addEventListener('mousemove', (e) => syncMouse(e.clientX, e.clientY));
  cvs.addEventListener('mousedown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    syncMouse(e.clientX, e.clientY);
    mouse.clicked = true;
    initAudio();
  });
  cvs.addEventListener('contextmenu', (e) => { if (e.preventDefault) e.preventDefault(); });
}

/* --- ekran tugmalari (telefon uchun) --- */
const BTN = {
  left:  { x: 24,  y: 436, w: 84, h: 84, label: '◀' },
  right: { x: 124, y: 436, w: 84, h: 84, label: '▶' },
  jump:  { x: 852, y: 436, w: 84, h: 84, label: '⤒' },
};
const touch = { on: false, left: false, right: false, jump: false, jumpTap: false, ids: {} };

function zoneAt(x, y) {
  for (const k in BTN) {
    const b = BTN[k];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return k;
  }
  return null;
}
function touchPoint(t) {
  if (typeof cvs.getBoundingClientRect !== 'function') return null;
  const r = cvs.getBoundingClientRect();
  if (!r || !r.width) return null;
  return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
}
function applyTouch(id, p, isStart) {
  const z = zoneAt(p.x, p.y);
  if (z) {
    touch.ids[id] = { zone: z };
    touch[z] = true;
    if (z === 'jump' && isStart) touch.jumpTap = true;
  } else {
    /* bo'sh joy = nishon + chap tugma (hujum / tasdiqlash) */
    touch.ids[id] = { zone: null };
    mouse.x = p.x; mouse.y = p.y;
    if (isStart) mouse.clicked = true;
  }
}

if (typeof cvs.addEventListener === 'function') {
  cvs.addEventListener('touchstart', (e) => {
    touch.on = true; initAudio();
    for (const t of e.touches) {
      const p = touchPoint(t);
      if (p) applyTouch(t.identifier, p, true);
    }
    if (e.preventDefault) e.preventDefault();
  }, { passive: false });
  cvs.addEventListener('touchmove', (e) => {
    for (const t of e.touches) {
      const p = touchPoint(t);
      if (!p) continue;
      const rec = touch.ids[t.identifier];
      const z = zoneAt(p.x, p.y);
      if (rec) {
        if (rec.zone !== z) {          /* tugmadan qo'ldirib tashlasa */
          if (rec.zone) touch[rec.zone] = false;
          rec.zone = z;
          if (z) { touch[z] = true; if (z === 'jump') touch.jumpTap = true; }
        }
      }
      if (!z) { mouse.x = p.x; mouse.y = p.y; }
    }
    if (e.preventDefault) e.preventDefault();
  }, { passive: false });
  const touchEnd = (e) => {
    for (const t of e.changedTouches) {
      const rec = touch.ids[t.identifier];
      if (rec) {
        if (rec.zone) touch[rec.zone] = false;
        delete touch.ids[t.identifier];
      }
    }
    if (e.preventDefault) e.preventDefault();
  };
  cvs.addEventListener('touchend', touchEnd, { passive: false });
  cvs.addEventListener('touchcancel', touchEnd, { passive: false });
}

function tap(code) {
  if (pressed[code]) { pressed[code] = false; return true; }
  return false;
}
function tapAny(list) { return list.some(tap); }
/* sichqonchaning chap tugmasi (yoki Enter) — barcha ekranlarda tasdiqlash */
function tapMouse() {
  if (mouse.clicked) { mouse.clicked = false; return true; }
  return false;
}
function tapConfirm() { return tapMouse() || tapAny(['Enter', 'Space']); }
const leftHeld  = () => !!(keys.ArrowLeft || keys.KeyA || touch.left);
const rightHeld = () => !!(keys.ArrowRight || keys.KeyD || touch.right);
const jumpHeld  = () => !!(keys.Space || keys.ArrowUp || keys.KeyW || touch.jump);
const jumpTap   = () => tapAny(['Space', 'ArrowUp', 'KeyW']) || (touch.jumpTap ? (touch.jumpTap = false, true) : false);

/* --------------------------------- audio -------------------------------- */
let actx = null;
let musicOn = true;
let mStep = 0, mTimer = 0;

function initAudio() {
  if (!actx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function tone(freq, dur, type, vol, slideTo) {
  if (!actx) return;
  try {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.07, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) { /* audio mavjud emas */ }
}

const sfx = {
  jump:   () => tone(400, 0.14, 'square', 0.06, 760),
  djump:  () => tone(560, 0.16, 'square', 0.06, 980),
  gem:    () => { tone(880, 0.07, 'sine', 0.09); setTimeout(() => tone(1320, 0.09, 'sine', 0.08), 55); },
  hit:    () => tone(240, 0.1, 'sawtooth', 0.07, 120),
  kill:   () => tone(180, 0.18, 'sawtooth', 0.08, 60),
  hurt:   () => tone(300, 0.25, 'sawtooth', 0.09, 90),
  power:  () => { tone(660, 0.08, 'triangle', 0.09); setTimeout(() => tone(990, 0.12, 'triangle', 0.09), 70); },
  door:   () => { tone(520, 0.1, 'sine', 0.09); setTimeout(() => tone(780, 0.16, 'sine', 0.09), 90); },
  clear:  () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.08), i * 110)),
  over:   () => [420, 330, 250, 160].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.08), i * 160)),
  win:    () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.09), i * 130)),
  shoot:  () => tone(700, 0.06, 'square', 0.04, 400),
  select: () => tone(660, 0.06, 'square', 0.06),
};

/* --------------------------- fon musiqasi ------------------------------
   Chiziqli arpejio: har 8 kadrda bitta notalar, D minor ohangda.
   WebAudio bo'lmasa — jim o'tadi (xato chiqmaydi).                         */
const MUSIC_SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46]; // D minor
const MUSIC_BASS  = [73.42, 73.42, 98.0, 98.0, 87.31, 87.31, 65.41, 65.41];
let musicPos = 0;

function musicTick() {
  if (!actx || !musicOn) return;
  mTimer--;
  if (mTimer > 0) return;
  mTimer = 9;                       // ~150 BPM (60fps / 9 kadr)
  try {
    const n = mStep % 16;
    /* bass har 2 qadamda */
    if (n % 2 === 0) tone(MUSIC_BASS[(n / 2) | 0], 0.16, 'triangle', 0.045);
    /* yuqori arpejio — har qadamda, lekin balandligi naqsh bo'yicha */
    const mel = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, 3];
    tone(MUSIC_SCALE[mel[n]] * (n % 8 === 7 ? 2 : 1), 0.1, 'square', 0.022);
    /* zarba (hi-hat) hissi */
    if (n % 4 === 2) tone(1200, 0.03, 'sawtooth', 0.012);
    mStep++;
    musicPos = mStep;
  } catch (e) { /* musiqa majburiy emas */ }
}

/* ------------------------------ o'yin holati ------------------------------ */
const GRAV = 0.55, MAXFALL = 14;
const MAX_LEVEL = 10;

let state = 'menu';      // menu | play | pause | clear | over | win
let levelNum = 1;
let score = 0;
let best = 0;
let combo = 0, comboT = 0;
let shake = 0;
let clearT = 0;
let uid = 1;

try { best = parseInt(localStorage.getItem('xazina_best') || '0', 10) || 0; } catch (e) { best = 0; }
function saveBest() {
  if (score > best) {
    best = score;
    try { localStorage.setItem('xazina_best', String(best)); } catch (e) { /* ignore */ }
  }
}

let lvl = null;          // joriy bosqich
let player = null;
let parts = [];          // zarrachalar
let floaters = [];       // uchuvchi matnlar
let projectiles = [];

const GRAVITY = 0.55;

function newPlayer() {
  return {
    x: 60, y: 400, w: 22, h: 30,
    vx: 0, vy: 0,
    facing: 1, onGround: false, coyote: 0, airJumps: 1,
    hp: 3, maxHp: 3, inv: 0,
    atk: 0, atkCd: 0, atkHits: null,
    spawnX: 60, spawnY: 400,
    pw: { speed: 0, magnet: 0, shield: 0 },
  };
}

/* ----------------------------- effektlar -------------------------------- */
function burst(x, y, n, color, power) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(1, power || 5);
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1,
      life: irand(18, 42),
      max: 42,
      size: rand(2, 5),
      color,
    });
  }
}

function floatText(x, y, text, color) {
  floaters.push({ x, y, text, color: color || '#fff', life: 55 });
}

/* --------------------------- bosqich yaratish --------------------------- */

/* Platformalar orasida sakrab yetib bo'ladiganlarni aniqlash (BFS).
   Sabab: yetib bo'lmaydigan platformada qolgan tosh bosqichi yakunlab bo'lmaydigan qiladi. */
function reachablePlatforms(platforms, from) {
  const reach = new Set();
  const start = [];
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (p.ground || (Math.abs(p.x + p.w / 2 - (from.x + 11)) < 220 && p.y >= from.y - 150)) start.push(i);
  }
  const queue = start.slice();
  start.forEach(i => reach.add(i));
  while (queue.length) {
    const i = queue.shift();
    const a = platforms[i];
    for (let j = 0; j < platforms.length; j++) {
      if (reach.has(j)) continue;
      const b = platforms[j];
      /* gorizontal bo'shlik va balandlik farqi sakrash doirasida bo'lishi kerak */
      const gapLeft = Math.max(a.x, b.x);
      const gapRight = Math.min(a.x + a.w, b.x + b.w);
      const gap = gapRight > gapLeft ? 0 : gapLeft - gapRight;
      const rise = a.y - b.y;      /* ijobiy = b yuqoriroq */
      const fall = b.y - a.y;
      if (gap <= 170 && rise <= 145 && fall <= 400) {
        reach.add(j);
        queue.push(j);
      }
    }
  }
  return reach;
}

function genLevel(n) {
  const groundY = H - 36;
  const platforms = [];
  const spikes = [];
  const gems = [];
  const enemies = [];
  const pickups = [];

  platforms.push({ x: 0, y: groundY, w: W, h: 36, ground: true });

  const isBoss = (n % 4 === 0) || n === MAX_LEVEL;

  /* --- zanjir platformalar (chinqiqib ko'tariladigan yo'l) --- */
  const chain = [];
  if (!isBoss) {
    let x = rand(110, 170);
    let y = groundY - rand(88, 104);
    const count = irand(5, 7);
    for (let i = 0; i < count && x < W - 170 && y > 92; i++) {
      const p = { x, y, w: rand(96, 150), h: 16 };
      platforms.push(p);
      chain.push(p);
      x += rand(90, 155);
      y -= rand(56, 96);
      if (y < 96) y = 96;
    }
    /* --- yon platformalar (qo'shimcha yo'nalish) --- */
    const extra = irand(2, 4);
    for (let i = 0; i < extra && chain.length; i++) {
      const base = chain[irand(0, chain.length - 1)];
      const p = {
        x: clamp(base.x + rand(-140, 140), 24, W - 150),
        y: clamp(base.y + rand(-80, 52), 110, groundY - 88),
        w: rand(84, 130), h: 16,
      };
      if (!platforms.some(q => Math.abs(q.x - p.x) < 70 && Math.abs(q.y - p.y) < 46)) {
        platforms.push(p);
        chain.push(p);
      }
    }
  } else {
    /* boss arenasi: ikkita yon platforma */
    platforms.push({ x: 90, y: groundY - 130, w: 170, h: 16 });
    platforms.push({ x: W - 260, y: groundY - 130, w: 170, h: 16 });
    platforms.push({ x: W / 2 - 90, y: groundY - 250, w: 180, h: 16 });
  }

  /* --- tirnoqlar (shiplar) --- */
  if (!isBoss) {
    const spikesN = clamp(1 + Math.floor(n / 2), 1, 5);
    for (let i = 0; i < spikesN; i++) {
      const w = rand(46, 78);
      const x = rand(300, W - 170 - w);
      if (spikes.some(s => Math.abs(s.x - x) < 90)) continue;
      spikes.push({ x, y: groundY - 16, w, h: 16 });
    }
  }

  /* --- darvoza (eshik) --- */
  const door = { x: W - 86, y: groundY - 64, w: 44, h: 64, open: false, t: 0 };

  /* --- maqsad --- */
  let objective;
  if (isBoss) {
    objective = { type: 'boss', need: 1, done: 0, label: 'BOSSNI YEQING' };
  } else if (n === 1 || n % 2 === 1) {
    objective = { type: 'gems', need: 0, done: 0, label: 'JEMLARNI YIG\'ING' };
  } else {
    objective = { type: 'clear', need: 0, done: 0, label: 'BARCHA DUSHMANLARNI YEQING' };
  }

  /* --- qimmatbaho toshlar --- */
  if (!isBoss) {
    /* faqat yetib bo'ladigan platformalarga tosh qo'yamiz */
    const reach = reachablePlatforms(platforms, { x: 60, y: groundY - 34 });
    const gemSpots = [];
    for (const p of platforms) {
      if (p.ground) {
        const cnt = irand(1, 2);
        for (let i = 0; i < cnt; i++) gemSpots.push({ x: rand(70, W - 150), y: groundY - 26 });
      } else if (reach.has(p)) {
        gemSpots.push({ x: p.x + rand(18, p.w - 18), y: p.y - 24 });
      }
    }
    for (const s of gemSpots) {
      if (spikes.some(k => s.x > k.x - 20 && s.x < k.x + k.w + 20 && s.y > k.y - 20)) continue;
      gems.push({ x: s.x, y: s.y, r: 9, got: false, t: rand(0, 6.28) });
    }
    /* hech bo'lmasa bitta tosh bo'lishi shart (aksi holda bosqich tugamaydi) */
    if (gems.length === 0) gems.push({ x: 200, y: groundY - 26, r: 9, got: false, t: 0 });
    if (objective.type === 'gems') objective.need = gems.length;
  }

  /* --- dushmanlar --- */
  if (isBoss) {
    const bossHp = 18 + n * 3;
    enemies.push({
      id: uid++, type: 'boss',
      x: W / 2 - 42, y: groundY - 78, w: 84, h: 78,
      vx: 0, vy: 0, dir: -1, hp: bossHp, maxHp: bossHp,
      onGround: false, flash: 0, hopT: 40, shootT: 90, t: 0,
    });
    objective.need = 1;
  } else {
    const walkers = clamp(1 + Math.floor(n / 2), 1, 5);
    for (let i = 0; i < walkers; i++) {
      const x = rand(340, W - 130);
      if (spikes.some(s => x > s.x - 40 && x < s.x + s.w + 40)) continue;
      enemies.push({
        id: uid++, type: 'walker',
        x, y: groundY - 26, w: 26, h: 26,
        vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1,
        speed: rand(1.1, 1.6) + n * 0.06,
        hp: 1 + Math.floor(n / 5), maxHp: 1 + Math.floor(n / 5),
        onGround: false, flash: 0, t: rand(0, 6),
      });
    }
    const flyers = n >= 2 ? clamp(Math.floor(n / 2), 1, 4) : 0;
    for (let i = 0; i < flyers; i++) {
      const y = rand(120, groundY - 170);
      enemies.push({
        id: uid++, type: 'flyer',
        x: rand(200, W - 120), y, w: 26, h: 22,
        vx: 0, vy: 0, baseY: y, speed: rand(1.0, 1.5) + n * 0.05,
        hp: 1, maxHp: 1, flash: 0, t: rand(0, 6),
      });
    }
    const shooters = n >= 3 ? clamp(Math.floor((n - 1) / 3), 1, 3) : 0;
    for (let i = 0; i < shooters; i++) {
      const p = chain.length ? chain[irand(0, chain.length - 1)] : null;
      const x = p ? p.x + p.w / 2 - 13 : rand(400, W - 140);
      enemies.push({
        id: uid++, type: 'shooter',
        x, y: (p ? p.y : groundY) - 34, w: 26, h: 34,
        vx: 0, vy: 0, hp: 2, maxHp: 2, flash: 0,
        shootT: irand(50, 110), t: 0,
      });
    }
    if (objective.type === 'clear' && enemies.length === 0) {
      enemies.push({
        id: uid++, type: 'walker',
        x: 480, y: groundY - 26, w: 26, h: 26,
        vx: 0, vy: 0, dir: 1, speed: 1.2,
        hp: 1, maxHp: 1, onGround: false, flash: 0, t: 0,
      });
    }
    if (objective.type === 'clear') objective.need = enemies.length;
  }

  /* --- kuchaytiricilar --- */
  const pickupTypes = ['speed', 'shield', 'magnet', 'heal'];
  const pickupN = irand(1, 2);
  for (let i = 0; i < pickupN; i++) {
    const p = chain.length ? chain[irand(0, chain.length - 1)] : null;
    pickups.push({
      x: p ? p.x + rand(20, p.w - 20) : rand(200, W - 200),
      y: p ? p.y - 26 : groundY - 26,
      type: pickupTypes[irand(0, pickupTypes.length - 1)],
      t: rand(0, 6), got: false,
    });
  }

  lvl = {
    n, groundY, platforms, spikes, gems, enemies, pickups,
    door, objective, isBoss,
    time: 0, banner: 100,
    hue: (n * 47) % 360,
  };

  projectiles = [];
  player.x = player.spawnX = 60;
  player.y = player.spawnY = groundY - player.h - 4;
  player.vx = player.vy = 0;
  player.atk = 0; player.atkCd = 0;
}

/* ------------------------------ fizika ---------------------------------- */
function moveEntity(e, dt) {
  e.hitWall = false;
  const dx = e.vx * dt, dy = e.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
  const sx = dx / steps, sy = dy / steps;

  for (let i = 0; i < steps; i++) {
    e.x += sx;
    for (const p of lvl.platforms) {
      if (overlap(e, p)) {
        if (sx > 0) e.x = p.x - e.w;
        else if (sx < 0) e.x = p.x + p.w;
        e.hitWall = true;
        e.vx = 0;
      }
    }
    e.y += sy;
    e.onGround = false;
    for (const p of lvl.platforms) {
      if (overlap(e, p)) {
        if (sy > 0) { e.y = p.y - e.h; e.vy = 0; e.onGround = true; }
        else if (sy < 0) { e.y = p.y + p.h; e.vy = 0; }
      }
    }
  }
  if (e.x < 0) { e.x = 0; e.hitWall = true; e.vx = 0; }
  if (e.x + e.w > W) { e.x = W - e.w; e.hitWall = true; e.vx = 0; }
}

/* ------------------------------ o'yinchi -------------------------------- */
function hurtPlayer(n, fromX) {
  const p = player;
  if (p.inv > 0 || state !== 'play') return;
  if (p.pw.shield > 0) {
    p.pw.shield = 0;
    p.inv = 45;
    shake = Math.max(shake, 7);
    burst(p.x + p.w / 2, p.y + p.h / 2, 14, '#6cf', 5);
    floatText(p.x, p.y - 10, 'DYSTAN!', '#6cf');
    sfx.hit();
    return;
  }
  p.hp -= n;
  p.inv = 90;
  p.vy = -6;
  p.vx = (p.x + p.w / 2 < fromX) ? -5 : 5;
  shake = Math.max(shake, 11);
  burst(p.x + p.w / 2, p.y + p.h / 2, 16, '#ff5566', 6);
  combo = 0; comboT = 0;
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    state = 'over';
    saveBest();
    sfx.over();
  }
}

function damageEnemy(e, dmg, kx) {
  e.hp -= dmg;
  e.flash = 8;
  e.vx = (kx || 0);
  burst(e.x + e.w / 2, e.y + e.h / 2, 6, '#ffd166', 4);
  if (e.hp <= 0) {
    const base = e.type === 'boss' ? 1000 : e.type === 'shooter' ? 150 : 100;
    combo = Math.min(9, combo + 1);
    comboT = 130;
    const gained = base * Math.max(1, combo);
    score += gained;
    floatText(e.x + e.w / 2, e.y - 6, '+' + gained, '#ffd166');
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'boss' ? 60 : 18,
          e.type === 'boss' ? '#ff6b6b' : '#ff9f43', e.type === 'boss' ? 9 : 6);
    shake = Math.max(shake, e.type === 'boss' ? 16 : 6);
    e.dead = true;
    sfx.kill();

    if (e.type !== 'boss' && Math.random() < 0.22) {
      const types = ['speed', 'shield', 'magnet', 'heal'];
      lvl.pickups.push({
        x: e.x + e.w / 2, y: e.y,
        type: types[irand(0, 3)], t: 0, got: false,
      });
    }
    if (e.type === 'boss') {
      lvl.objective.done = 1;
      openDoor();
    }
  } else {
    sfx.hit();
  }
}

function openDoor() {
  if (!lvl.door.open) {
    lvl.door.open = true;
    sfx.door();
    floatText(lvl.door.x + 22, lvl.door.y - 8, 'ESHIK OCHILDI!', '#7bed9f');
    burst(lvl.door.x + 22, lvl.door.y + 30, 24, '#7bed9f', 6);
  }
}

function checkObjective() {
  const o = lvl.objective;
  if (lvl.door.open) return;
  if (o.type === 'gems') o.done = lvl.gems.filter(g => g.got).length;
  else if (o.type === 'clear') o.done = lvl.enemies.filter(e => !e.dead).length === 0 ? 1 : 0;
  else if (o.type === 'boss') o.done = lvl.enemies.some(e => e.type === 'boss' && !e.dead) ? 0 : 1;

  const done = o.type === 'clear' || o.type === 'boss' ? o.done >= 1 : o.done >= o.need;
  if (done && o.need > 0) openDoor();
}

function updatePlayer(dt) {
  const p = player;
  const spd = p.pw.speed > 0 ? 7.4 : 5.0;
  const acc = 1.0;

  let mv = 0;
  if (leftHeld()) mv -= 1;
  if (rightHeld()) mv += 1;
  if (mv !== 0) { p.vx += mv * acc * dt; p.facing = mv; }
  else p.vx *= Math.pow(0.78, dt);
  p.vx = clamp(p.vx, -spd, spd);

  /* sakrash */
  const wantJump = jumpTap();
  if (p.onGround) { p.coyote = 7; p.airJumps = 1; }
  else if (p.coyote > 0) p.coyote -= dt;

  if (wantJump) {
    if (p.onGround || p.coyote > 0) {
      p.vy = -13.2; p.onGround = false; p.coyote = 0;
      sfx.jump();
      burst(p.x + p.w / 2, p.y + p.h, 5, '#aab', 3);
    } else if (p.airJumps > 0) {
      p.vy = -12.2; p.airJumps--;
      sfx.djump();
      burst(p.x + p.w / 2, p.y + p.h, 10, '#8ecbff', 4);
    }
  }
  /* sakrashni erta to'xtatish (yengil sakrash) */
  if (!jumpHeld() && p.vy < -5) p.vy = -5;

  /* hujum — sichqonchaning chap tugmasi (X/J kerak emas) */
  if (p.atkCd > 0) p.atkCd -= dt;
  const wantAtk = tapMouse();
  if (wantAtk && p.atkCd <= 0) {
    /* sichqoncha tomoniga qarab hujum qilamiz */
    const aimX = mouse.x - (p.x + p.w / 2);
    if (Math.abs(aimX) > 4) p.facing = aimX > 0 ? 1 : -1;
    p.atk = 15; p.atkCd = 24; p.atkHits = new Set();
    tone(760, 0.07, 'square', 0.05, 420);
    burst(p.x + p.w / 2 + p.facing * 26, p.y + p.h / 2, 6, '#fff2a8', 4);
  }
  if (p.atk > 0) p.atk -= dt;

  /* fizika */
  p.vy += GRAVITY * dt;
  if (p.vy > MAXFALL) p.vy = MAXFALL;
  moveEntity(p, dt);

  if (p.inv > 0) p.inv -= dt;
  if (p.pw.speed > 0) p.pw.speed -= dt;
  if (p.pw.magnet > 0) p.pw.magnet -= dt;

  /* chuqurga tushish */
  if (p.y > H + 40) {
    p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0;
    hurtPlayer(1, p.x + 1);
  }

  /* shiplar (tirnoqlar) */
  for (const s of lvl.spikes) {
    const box = { x: s.x + 3, y: s.y + 6, w: s.w - 6, h: s.h - 6 };
    if (overlap(p, box)) { hurtPlayer(1, s.x + s.w / 2); break; }
  }

  /* hujum hitboxi — sichqoncha tomonga 60° konus ichida */
  if (p.atk > 4) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const aim = Math.atan2(mouse.y - cy, mouse.x - cx);
    const RANGE = 52, COS = Math.cos(1.0);   /* ±57° */
    const hits = (tx, ty, r) => {
      const dx = tx - cx, dy = ty - cy;
      const d = Math.hypot(dx, dy);
      if (d > RANGE + r || d < 0.001) return false;
      return (dx * Math.cos(aim) + dy * Math.sin(aim)) / d > COS;
    };
    for (const e of lvl.enemies) {
      if (e.dead || p.atkHits.has(e.id)) continue;
      if (hits(e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) / 2)) {
        p.atkHits.add(e.id);
        damageEnemy(e, 1, Math.cos(aim) * 7);
      }
    }
    for (const pr of projectiles) {
      if (pr.from === 'e' && !pr.dead && hits(pr.x, pr.y, pr.r)) {
        pr.dead = true;
        burst(pr.x, pr.y, 5, '#ffd166', 3);
        score += 10;
      }
    }
  }

  /* dushmanlar bilan to'qnashuv */
  for (const e of lvl.enemies) {
    if (e.dead || !overlap(p, e)) continue;
    const stomp = p.vy > 2 && (p.y + p.h) - e.y < 16;
    if (stomp) {
      p.vy = -9.5;
      damageEnemy(e, 2, 0);
      combo = Math.min(9, combo + 1);
      comboT = 130;
    } else {
      hurtPlayer(1, e.x + e.w / 2);
    }
  }

  /* jamiy (loyindan) otilgan sharlar */
  for (const pr of projectiles) {
    if (pr.dead || pr.from !== 'e') continue;
    if (overlap(p, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) {
      pr.dead = true;
      hurtPlayer(1, pr.x);
    }
  }

  /* qimmatbaho toshlar */
  for (const g of lvl.gems) {
    if (g.got) continue;
    g.t += 0.06 * dt;
    if (p.pw.magnet > 0) {
      const dx = (p.x + p.w / 2) - g.x, dy = (p.y + p.h / 2) - g.y;
      const d = Math.hypot(dx, dy);
      if (d < 190) { g.x += (dx / d) * 4.5 * dt; g.y += (dy / d) * 4.5 * dt; }
    }
    if (Math.hypot((p.x + p.w / 2) - g.x, (p.y + p.h / 2) - g.y) < 24) {
      g.got = true;
      score += 50;
      burst(g.x, g.y, 10, '#4ecdc4', 5);
      floatText(g.x, g.y - 8, '+50', '#4ecdc4');
      sfx.gem();
      checkObjective();
    }
  }

  /* kuchaytiricilar */
  for (const k of lvl.pickups) {
    if (k.got) continue;
    k.t += 0.05 * dt;
    if (overlap(p, { x: k.x - 12, y: k.y - 12, w: 24, h: 24 })) {
      k.got = true;
      sfx.power();
      burst(k.x, k.y, 16, '#fff', 6);
      if (k.type === 'speed') { p.pw.speed = 600; floatText(k.x, k.y - 14, 'TEZLIK!', '#ffeaa7'); }
      else if (k.type === 'shield') { p.pw.shield = 1; floatText(k.x, k.y - 14, 'DYSTAN!', '#6cf'); }
      else if (k.type === 'magnet') { p.pw.magnet = 600; floatText(k.x, k.y - 14, 'MAGNIT!', '#ff7675'); }
      else if (k.type === 'heal') {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        floatText(k.x, k.y - 14, '+1 YURAK', '#ff7675');
      }
      score += 75;
    }
  }

  /* darvozaga kirish */
  if (lvl.door.open && overlap(p, lvl.door)) {
    const bonus = 300 * lvl.n + player.hp * 100;
    score += bonus;
    saveBest();
    state = 'clear';
    clearT = 150;
    sfx.clear();
  }
}

/* ------------------------------ dushmanlar ------------------------------ */
function updateEnemies(dt) {
  for (const e of lvl.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    e.t += 0.05 * dt;

    if (e.type === 'walker') {
      e.vy += GRAVITY * dt;
      if (e.vy > MAXFALL) e.vy = MAXFALL;
      e.vx = e.dir * e.speed;

      /* oldida pol bormi? */
      const aheadX = e.dir > 0 ? e.x + e.w + 6 : e.x - 6;
      const probe = { x: aheadX, y: e.y + e.h + 2, w: 4, h: 8 };
      const groundAhead = lvl.platforms.some(p => overlap(probe, p));
      if (!groundAhead) e.dir *= -1;

      moveEntity(e, dt);
      if (e.hitWall) e.dir *= -1;
      if (e.y > H + 60) e.dead = true;
    }
    else if (e.type === 'flyer') {
      const pc = player.x + player.w / 2;
      const ec = e.x + e.w / 2;
      e.vx = clamp((pc - ec) * 0.02, -1, 1) * e.speed * 1.4;
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(e.t * 1.6) * 30;
      if (e.x < 8) e.x = 8;
      if (e.x + e.w > W - 8) e.x = W - 8 - e.w;
      e.baseY += clamp((player.y - e.baseY) * 0.004, -0.5, 0.5) * dt;
      e.baseY = clamp(e.baseY, 80, lvl.groundY - 90);
    }
    else if (e.type === 'shooter') {
      e.vy += GRAVITY * dt;
      moveEntity(e, dt);
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = clamp(irand(75, 115) - lvl.n * 3, 38, 115);
        const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
        const dy = (player.y + player.h / 2) - (e.y + 10);
        const d = Math.hypot(dx, dy) || 1;
        projectiles.push({
          x: e.x + e.w / 2, y: e.y + 10,
          vx: (dx / d) * 5.2, vy: (dy / d) * 5.2,
          r: 5, life: 150, from: 'e', dead: false,
        });
        sfx.shoot();
      }
    }
    else if (e.type === 'boss') {
      e.vy += GRAVITY * dt;
      if (e.vy > MAXFALL) e.vy = MAXFALL;
      e.hopT -= dt;
      e.shootT -= dt;

      if (e.onGround) {
        e.vx *= Math.pow(0.8, dt);
        if (e.hopT <= 0) {
          const dir = Math.sign((player.x) - (e.x)) || -1;
          e.vy = -11.5;
          e.vx = dir * rand(2.4, 4.4);
          e.hopT = rand(55, 95);
          burst(e.x + e.w / 2, e.y + e.h, 10, '#ff6b6b', 5);
        }
        if (e.shootT <= 0) {
          e.shootT = rand(75, 115);
          const base = Math.atan2(
            (player.y + player.h / 2) - (e.y + 24),
            (player.x + player.w / 2) - (e.x + e.w / 2)
          );
          for (let k = -1; k <= 1; k++) {
            const a = base + k * 0.32;
            projectiles.push({
              x: e.x + e.w / 2, y: e.y + 24,
              vx: Math.cos(a) * 5.6, vy: Math.sin(a) * 5.6,
              r: 6, life: 170, from: 'e', dead: false,
            });
          }
          sfx.shoot();
        }
      }
      moveEntity(e, dt);
      if (e.hitWall && e.onGround) e.dir *= -1;
    }
  }

  /* o'liklarni tozalash */
  lvl.enemies = lvl.enemies.filter(e => !e.dead);
  checkObjective();
}

function updateProjectiles(dt) {
  for (const pr of projectiles) {
    if (pr.dead) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.life <= 0 || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) pr.dead = true;
    if (pr.dead) continue;
    for (const p of lvl.platforms) {
      if (overlap({ x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 }, p)) {
        pr.dead = true;
        burst(pr.x, pr.y, 4, '#ff9f43', 3);
        break;
      }
    }
  }
  projectiles = projectiles.filter(p => !p.dead);
}

function updateEffects(dt) {
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 0.16 * dt;
    p.life -= dt;
  }
  parts = parts.filter(p => p.life > 0);
  for (const f of floaters) { f.y -= 0.7 * dt; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);
  if (shake > 0) shake = Math.max(0, shake - 0.7 * dt);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
}

/* ------------------------------ yangilash -------------------------------- */
function update(dt) {
  if (tap('KeyM')) { musicOn = !musicOn; sfx.select(); }
  musicTick();

  switch (state) {
    case 'menu':
      if (tapConfirm()) startGame();
      break;

    case 'play':
      if (tap('KeyP') || tap('Escape')) { state = 'pause'; sfx.select(); break; }
      if (lvl.banner > 0) lvl.banner -= dt;
      lvl.time += dt;
      updatePlayer(dt);
      if (state === 'play') {
        updateEnemies(dt);
        updateProjectiles(dt);
      }
      updateEffects(dt);
      break;

    case 'pause':
      if (tap('KeyP') || tap('Escape') || tapConfirm()) { state = 'play'; sfx.select(); }
      break;

    case 'clear':
      updateEffects(dt);
      clearT -= dt;
      if (clearT <= 0 || tapConfirm()) nextLevel();
      break;

    case 'over':
      updateEffects(dt);
      if (tapConfirm()) { state = 'menu'; sfx.select(); }
      break;

    case 'win':
      updateEffects(dt);
      if (tapConfirm()) { state = 'menu'; sfx.select(); }
      break;
  }
}

function startGame() {
  levelNum = 1;
  score = 0;
  combo = 0; comboT = 0;
  player = newPlayer();
  genLevel(levelNum);
  state = 'play';
  parts = []; floaters = [];
  sfx.select();
}

function nextLevel() {
  levelNum++;
  if (levelNum > MAX_LEVEL) {
    state = 'win';
    saveBest();
    sfx.win();
    return;
  }
  player.hp = Math.min(player.maxHp, player.hp + 1);
  player.pw.speed = 0; player.pw.magnet = 0;
  genLevel(levelNum);
  parts = []; floaters = [];
  state = 'play';
}

/* ================================ CHIZISH ================================ */
function drawBG() {
  const hue = lvl ? lvl.hue : 0;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${hue}, 45%, 12%)`);
  g.addColorStop(0.6, `hsl(${(hue + 30) % 360}, 50%, 8%)`);
  g.addColorStop(1, '#07070d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* yulduzlar */
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const sx = (i * 137.5 + (lvl ? lvl.time * (i % 3 + 1) * 0.15 : 0)) % W;
    const sy = (i * 71.3) % (H * 0.75);
    ctx.globalAlpha = 0.25 + ((i * 37) % 50) / 120;
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.restore();

  /* uzoq binolar silueti */
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = `hsl(${hue}, 40%, 16%)`;
  for (let i = 0; i < 12; i++) {
    const bw = 60 + (i * 53) % 70;
    const bh = 90 + (i * 97) % 190;
    ctx.fillRect(i * 84 - 20, H - 36 - bh, bw, bh);
  }
  ctx.restore();
}

function drawPlatforms() {
  for (const p of lvl.platforms) {
    if (p.ground) {
      const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
      g.addColorStop(0, '#2d3350');
      g.addColorStop(1, '#171a2e');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = `hsl(${lvl.hue}, 70%, 60%)`;
      ctx.fillRect(p.x, p.y, p.w, 3);
      /* naqsh */
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let x = p.x + 16; x < p.x + p.w; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, p.y + 6); ctx.lineTo(x - 10, p.y + p.h);
        ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.shadowColor = `hsl(${lvl.hue}, 80%, 60%)`;
      ctx.shadowBlur = 12;
      const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
      g.addColorStop(0, `hsl(${lvl.hue}, 35%, 38%)`);
      g.addColorStop(1, `hsl(${lvl.hue}, 35%, 20%)`);
      ctx.fillStyle = g;
      rr(p.x, p.y, p.w, p.h, 5);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = `hsl(${lvl.hue}, 85%, 68%)`;
      rr(p.x + 2, p.y, p.w - 4, 3, 2);
      ctx.fill();
    }
  }
}

function drawSpikes() {
  for (const s of lvl.spikes) {
    const n = Math.max(2, Math.round(s.w / 14));
    const step = s.w / n;
    ctx.fillStyle = '#c8d0f0';
    ctx.strokeStyle = '#5b6490';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * step, s.y + s.h);
      ctx.lineTo(s.x + i * step + step / 2, s.y);
      ctx.lineTo(s.x + (i + 1) * step, s.y + s.h);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
}

function drawGems() {
  for (const g of lvl.gems) {
    if (g.got) continue;
    const bob = Math.sin(g.t * 2) * 4;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(Math.sin(g.t) * 0.4);
    ctx.shadowColor = '#4ecdc4';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#4ecdc4';
    ctx.beginPath();
    ctx.moveTo(0, -g.r); ctx.lineTo(g.r * 0.8, 0);
    ctx.lineTo(0, g.r); ctx.lineTo(-g.r * 0.8, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -g.r); ctx.lineTo(g.r * 0.3, -g.r * 0.3);
    ctx.lineTo(-g.r * 0.2, -g.r * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawPickups() {
  const info = {
    speed:  { c: '#ffeaa7', t: '»' },
    shield: { c: '#6cf',    t: 'O' },
    magnet: { c: '#ff7675', t: 'U' },
    heal:   { c: '#ff9ff3', t: '+' },
  };
  for (const k of lvl.pickups) {
    if (k.got) continue;
    const bob = Math.sin(k.t * 2.4) * 4;
    const i = info[k.type];
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    ctx.shadowColor = i.c; ctx.shadowBlur = 14;
    ctx.fillStyle = i.c;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#141425';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i.t, 0, 1);
    ctx.restore();
  }
}

function drawDoor() {
  const d = lvl.door;
  d.t += 0.05;
  ctx.save();
  if (d.open) {
    ctx.shadowColor = '#7bed9f'; ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(123,237,159,0.18)';
    rr(d.x, d.y, d.w, d.h, 8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#7bed9f';
    ctx.lineWidth = 3;
    rr(d.x, d.y, d.w, d.h, 8); ctx.stroke();
    ctx.fillStyle = '#7bed9f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('»', d.x + d.w / 2, d.y + d.h / 2 + Math.sin(d.t * 3) * 4);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    rr(d.x, d.y, d.w, d.h, 8); ctx.fill();
    ctx.strokeStyle = '#5b6490';
    ctx.lineWidth = 3;
    rr(d.x, d.y, d.w, d.h, 8); ctx.stroke();
    /* qulf */
    ctx.strokeStyle = '#8890c0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(d.x + d.w / 2, d.y + 26, 9, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#8890c0';
    rr(d.x + d.w / 2 - 11, d.y + 26, 22, 18, 4);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemies() {
  for (const e of lvl.enemies) {
    if (e.dead) continue;
    ctx.save();
    if (e.flash > 0 && Math.floor(e.flash) % 2 === 0) ctx.globalAlpha = 0.5;

    if (e.type === 'walker') {
      ctx.fillStyle = '#ff7f50';
      rr(e.x, e.y, e.w, e.h, 6); ctx.fill();
      ctx.fillStyle = '#2b2b3d';
      const ex = e.dir > 0 ? e.x + 16 : e.x + 5;
      ctx.beginPath(); ctx.arc(ex, e.y + 9, 3.5, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + (e.dir > 0 ? 7 : -7) + 7 * (e.dir > 0 ? 1 : 1), e.y + 9, 3.5, 0, 6.283); ctx.fill();
      /* og'iz */
      ctx.strokeStyle = '#2b2b3d'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + 6, e.y + 19); ctx.lineTo(e.x + e.w - 6, e.y + 19);
      ctx.stroke();
      /* tirnoqlar */
      ctx.fillStyle = '#e17055';
      ctx.fillRect(e.x + 3, e.y + e.h - 3, 6, 3);
      ctx.fillRect(e.x + e.w - 9, e.y + e.h - 3, 6, 3);
    } else if (e.type === 'flyer') {
      const flap = Math.sin(e.t * 8) * 7;
      ctx.fillStyle = '#a29bfe';
      /* qanotlar */
      ctx.beginPath();
      ctx.moveTo(e.x + 4, e.y + 10);
      ctx.lineTo(e.x - 12, e.y + 4 + flap);
      ctx.lineTo(e.x + 4, e.y + 18);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.x + e.w - 4, e.y + 10);
      ctx.lineTo(e.x + e.w + 12, e.y + 4 + flap);
      ctx.lineTo(e.x + e.w - 4, e.y + 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6c5ce7';
      rr(e.x, e.y, e.w, e.h, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x + 8, e.y + 9, 4, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + e.w - 8, e.y + 9, 4, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#2d3436';
      ctx.beginPath(); ctx.arc(e.x + 9, e.y + 9, 2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + e.w - 7, e.y + 9, 2, 0, 6.283); ctx.fill();
    } else if (e.type === 'shooter') {
      ctx.fillStyle = '#00b894';
      rr(e.x, e.y, e.w, e.h, 5); ctx.fill();
      ctx.fillStyle = '#00cec9';
      rr(e.x + 4, e.y + 5, e.w - 8, 10, 3); ctx.fill();
      ctx.fillStyle = '#0a3d2b';
      ctx.fillRect(e.x + 7, e.y + 8, e.w - 14, 4);
      ctx.fillStyle = '#55efc4';
      ctx.fillRect(e.x + 6, e.y + 22, e.w - 12, 4);
      /* barrel */
      const dx = player.x - e.x, dy = player.y - e.y;
      const a = Math.atan2(dy, dx);
      ctx.strokeStyle = '#00cec9'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y + 10);
      ctx.lineTo(e.x + e.w / 2 + Math.cos(a) * 16, e.y + 10 + Math.sin(a) * 16);
      ctx.stroke();
    } else if (e.type === 'boss') {
      ctx.shadowColor = '#ff6b6b';
      ctx.shadowBlur = 18 + Math.sin(e.t * 4) * 6;
      const g = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.h);
      g.addColorStop(0, '#ff6b6b');
      g.addColorStop(1, '#b33939');
      ctx.fillStyle = g;
      rr(e.x, e.y, e.w, e.h, 14); ctx.fill();
      ctx.shadowBlur = 0;
      /* shoxlar */
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath();
      ctx.moveTo(e.x + 8, e.y + 6); ctx.lineTo(e.x + 2, e.y - 16); ctx.lineTo(e.x + 22, e.y + 4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.x + e.w - 8, e.y + 6); ctx.lineTo(e.x + e.w - 2, e.y - 16); ctx.lineTo(e.x + e.w - 22, e.y + 4);
      ctx.closePath(); ctx.fill();
      /* ko'zlar */
      const look = Math.sign(player.x - e.x) * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x + 26, e.y + 30, 11, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + e.w - 26, e.y + 30, 11, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#2d3436';
      ctx.beginPath(); ctx.arc(e.x + 26 + look, e.y + 32, 5, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + e.w - 26 + look, e.y + 32, 5, 0, 6.283); ctx.fill();
      /* og'iz */
      ctx.fillStyle = '#6b1f1f';
      rr(e.x + 22, e.y + 52, e.w - 44, 14, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(e.x + 26 + i * 12, e.y + 52);
        ctx.lineTo(e.x + 32 + i * 12, e.y + 62);
        ctx.lineTo(e.x + 38 + i * 12, e.y + 52);
        ctx.closePath(); ctx.fill();
      }
      /* HP chizig'i */
      const bw = 90;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      rr(e.x + e.w / 2 - bw / 2, e.y - 20, bw, 9, 4); ctx.fill();
      ctx.fillStyle = '#ff6b6b';
      rr(e.x + e.w / 2 - bw / 2 + 1, e.y - 19, (bw - 2) * (e.hp / e.maxHp), 7, 3);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const p = player;
  if (p.inv > 0 && Math.floor(p.inv / 5) % 2 === 0) return;

  ctx.save();
  /* hujum yoyi — sichqoncha tomoniga nishonlangan */
  if (p.atk > 4) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const aim = Math.atan2(mouse.y - cy, mouse.x - cx);
    const spread = 1.1 + (p.atk / 15) * 0.7;   /* yoy ochiladi */
    ctx.beginPath();
    ctx.arc(cx, cy, 34, aim - spread / 2, aim + spread / 2);
    ctx.stroke();
    /* uchi yaltiraydi */
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(aim + spread / 2) * 34, cy + Math.sin(aim + spread / 2) * 34, 3.5, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }

  /* tanasi */
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#8ecbff');
  g.addColorStop(1, '#4a90d9');
  ctx.fillStyle = g;
  rr(p.x, p.y, p.w, p.h, 6);
  ctx.fill();

  /* bosh/ko'zlar */
  ctx.fillStyle = '#fff';
  const ex = p.facing > 0 ? p.x + 13 : p.x + 4;
  ctx.fillRect(ex, p.y + 7, 5, 5);
  ctx.fillRect(ex + (p.facing > 0 ? 7 : -1) + 1, p.y + 7, 5, 5);
  ctx.fillStyle = '#16213e';
  ctx.fillRect(ex + (p.facing > 0 ? 2 : 1), p.y + 9, 2, 3);
  ctx.fillRect(ex + (p.facing > 0 ? 9 : -1) + 1, p.y + 9, 2, 3);

  /* sharf */
  ctx.strokeStyle = '#ff7675';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + 3, p.y + 15);
  ctx.lineTo(p.x + p.w - 3, p.y + 15);
  ctx.stroke();

  /* dyustan aylanası */
  if (p.pw.shield > 0) {
    ctx.strokeStyle = 'rgba(102,204,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 24 + Math.sin(lvl.time * 0.15) * 2, 0, 6.283);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectiles() {
  for (const pr of projectiles) {
    ctx.save();
    ctx.shadowColor = '#ff9f43'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}

function drawEffects() {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 25);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHeart(x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? '#ff5f6d' : 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-9, -4, -4, -12, 0, -6);
  ctx.bezierCurveTo(4, -12, 9, -4, 0, 4);
  ctx.fill();
  ctx.restore();
}

function drawHUD() {
  ctx.textBaseline = 'alphabetic';

  /* yuraklar */
  for (let i = 0; i < player.maxHp; i++) drawHeart(26 + i * 24, 28, i < player.hp);

  /* kuchaytirichi taymerlari */
  let px = 20;
  const pw = [];
  if (player.pw.speed > 0) pw.push(['TEZLIK', player.pw.speed / 600, '#ffeaa7']);
  if (player.pw.magnet > 0) pw.push(['MAGNIT', player.pw.magnet / 600, '#ff7675']);
  if (player.pw.shield > 0) pw.push(['DYSTAN', 1, '#6cf']);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  for (const [name, frac, color] of pw) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(px, 44, 66, 14, 7); ctx.fill();
    ctx.fillStyle = color;
    rr(px + 2, 46, 62 * clamp(frac, 0, 1), 10, 5); ctx.fill();
    ctx.fillStyle = '#12121f';
    ctx.fillText(name, px + 5, 55);
    px += 72;
  }

  /* maqsad */
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  const o = lvl.objective;
  const prog = o.type === 'gems' ? `${o.done}/${o.need}` : (o.done >= 1 ? '✓' : '✗');
  const label = `${o.label}  ${prog}`;
  const tw = ctx.measureText(label).width;
  rr(W / 2 - tw / 2 - 12, 14, tw + 24, 24, 12);
  ctx.fill();
  ctx.fillStyle = lvl.door.open ? '#7bed9f' : '#ffeaa7';
  ctx.fillText(label, W / 2, 31);

  /* ball + rekord */
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(String(score).padStart(6, '0'), W - 18, 30);
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('REKORD ' + best, W - 18, 46);

  /* bosqich */
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('BOSQICH ' + lvl.n + '/' + MAX_LEVEL, 20, H - 16);

  /* kombo */
  if (combo > 1) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('x' + combo, W - 20, H - 20);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,209,102,0.7)';
    ctx.fillText('KOMBO!', W - 20, H - 6);
  }

  if (!musicOn) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px sans-serif';
    ctx.fillText('musiqa: o\'chiq (M)', W / 2, H - 12);
  }

  /* bosqich banneri */
  if (lvl.banner > 0) {
    const a = Math.min(1, lvl.banner / 40);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('BOSQICH ' + lvl.n, W / 2, H / 2 - 30);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = lvl.isBoss ? '#ff6b6b' : '#ffeaa7';
    ctx.fillText(lvl.isBoss ? 'DIQQAT: BOSS!' : lvl.objective.label, W / 2, H / 2 + 4);
    ctx.globalAlpha = 1;
  }
}

function drawOverlay() {
  ctx.fillStyle = 'rgba(6,6,14,0.78)';
  ctx.fillRect(0, 0, W, H);
}

function drawMenu() {
  drawBG();
  ctx.textAlign = 'center';

  ctx.save();
  ctx.shadowColor = '#4ecdc4'; ctx.shadowBlur = 26;
  ctx.fillStyle = '#4ecdc4';
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('XAZINA QUVG\'U', W / 2, 150);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Tasodifiy bosqichlar · dushmanlar · bosslar · kuchaytiricilar', W / 2, 184);

  const items = [
    ['← →  /  A D', 'yurish'],
    ['SPACE', 'sakrash (ikkinchi sakrash bor!)'],
    ['SICHQONCHA (LMB)', 'hujum — sichqoncha tomoniga nishon oladi'],
    ['P', 'pauza      M — musiqa'],
  ];
  ctx.font = '15px sans-serif';
  let y = 250;
  for (const [k, v] of items) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffeaa7';
    ctx.fillText(k, W / 2 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(v, W / 2 + 20, y);
    y += 34;
  }

  const blink = Math.floor(performance.now() / 450) % 2 === 0;
  if (blink) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SICHQONCHANI BOSIB BOSHLANG', W / 2, 430);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '13px monospace';
  ctx.fillText('REKORD: ' + best, W / 2, 476);
}

function drawEndScreen(win) {
  drawOverlay();
  ctx.textAlign = 'center';
  ctx.save();
  if (win) { ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 30; }
  ctx.fillStyle = win ? '#ffd166' : '#ff5f6d';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(win ? 'G\'ALABA!' : 'YEQILDING!', W / 2, 210);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('BALL: ' + score, W / 2, 270);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '18px monospace';
  ctx.fillText('REKORD: ' + best, W / 2, 304);
  if (win) {
    ctx.fillStyle = '#7bed9f';
    ctx.font = '16px sans-serif';
    ctx.fillText('Barcha ' + MAX_LEVEL + ' bosqichni yakunlading!', W / 2, 344);
  }

  const blink = Math.floor(performance.now() / 450) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SICHQONCHA — MENYUGA', W / 2, 420);
  }
}

function drawClear() {
  drawOverlay();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7bed9f';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('BOSQICH YAKUNLANDI!', W / 2, 230);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('BALL: ' + score, W / 2, 285);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Keyingi bosqich ...', W / 2, 330);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (state === 'menu') { drawMenu(); return; }

  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

  drawBG();
  drawPlatforms();
  drawSpikes();
  drawDoor();
  drawGems();
  drawPickups();
  drawEnemies();
  drawPlayer();
  drawProjectiles();
  drawEffects();

  ctx.restore();

  drawHUD();

  if (state === 'pause') {
    drawOverlay();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('PAUZA', W / 2, H / 2 - 10);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Davom etish uchun P yoki sichqonchani bosing', W / 2, H / 2 + 30);
  } else if (state === 'clear') {
    drawClear();
  } else if (state === 'over') {
    drawEndScreen(false);
  } else if (state === 'win') {
    drawEndScreen(true);
  }

  drawCrosshair();
  if (touch.on && state === 'play') drawTouchPad();
}

/* Telefon uchun ekran tugmalari */
function drawTouchPad() {
  for (const k in BTN) {
    const b = BTN[k];
    const active = touch[k];
    ctx.save();
    ctx.globalAlpha = active ? 0.75 : 0.35;
    ctx.fillStyle = active ? '#ffeaa7' : '#1b1f45';
    rr(b.x, b.y, b.w, b.h, 18);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? '#fff' : '#5b6490';
    rr(b.x, b.y, b.w, b.h, 18);
    ctx.stroke();
    ctx.fillStyle = active ? '#141425' : '#cfd3ff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}

/* O'z nishonimiz (cursor: none) — hujumda kattalashadi va qizarg'aydi */
function drawCrosshair() {
  const ready = player && player.atkCd <= 0;
  const t = (player && lvl) ? lvl.time : performance.now() / 16.67;
  const r = (ready ? 11 : 7) + Math.sin(t * 0.25) * 1.5;
  const col = state === 'play'
    ? (ready ? 'rgba(255,242,168,0.95)' : 'rgba(255,255,255,0.35)')
    : 'rgba(123,237,159,0.9)';

  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
  /* 4 tish */
  ctx.beginPath();
  ctx.moveTo(-r - 6, 0); ctx.lineTo(-r + 3, 0);
  ctx.moveTo(r - 3, 0);  ctx.lineTo(r + 6, 0);
  ctx.moveTo(0, -r - 6); ctx.lineTo(0, -r + 3);
  ctx.moveTo(0, r - 3);  ctx.lineTo(0, r + 6);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 6.283); ctx.fill();

  /* hujumga tayyor bo'lganda atrofda aylanuvchi halqa */
  if (state === 'play' && ready) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, t * 0.15, t * 0.15 + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------------- sikl --------------------------------- */
/* bitta kadr: yangilash + chizish + bosilgan tugmalarni tozalash */
function step(dt) {
  update(dt);
  render();
  for (const k in pressed) delete pressed[k];
  mouse.clicked = false;
  touch.jumpTap = false;
}

let last = 0;
function loop(t) {
  const dt = clamp((t - last) / 16.667, 0, 2.5) || 1;
  last = t;
  step(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });

/* test uchun kichik ilova (brauzerda zararsiz) */
if (typeof window !== 'undefined') {
  window.__game = {
    get state() { return state; },
    set state(s) { state = s; },
    get score() { return score; },
    set score(v) { score = v; },
    get level() { return levelNum; },
    get player() { return player; },
    get lvl() { return lvl; },
    get mouse() { return mouse; },
    get musicOn() { return musicOn; },
    start: startGame,
    update,
    render,
    step,
    gen(n) { levelNum = n; genLevel(n); },
    reach: reachablePlatforms,
  };
}
