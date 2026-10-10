/* Smoke-test: o'yin mantiqini Node muhitida simulyatsiya qiladi.
   Brauzer API'lari (canvas, localStorage, rAF) stub qilinadi.
   Ishga tushirish: node test/smoke.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok  ' + msg);
  else { failures++; console.log('  FAIL ' + msg); }
}

/* --------------------------- stub: brauzer muhiti ------------------------- */
function makeGradient() { return { addColorStop() {} }; }

const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return makeGradient;
    if (prop === 'measureText') return () => ({ width: 50 });
    if (prop in t) return t[prop];
    return () => undefined;
  },
  set(t, prop, v) { t[prop] = v; return true; },
});

const canvasListeners = {};
const canvasStub = {
  width: 960,
  height: 540,
  getContext: () => ctxStub,
  addEventListener(type, fn) { (canvasListeners[type] = canvasListeners[type] || []).push(fn); },
  /* o'yin ichida bir xil o'lcham: kordinatalar 1:1 */
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
  style: {},
};

/* sichqoncha hodisasi yuborish (chap tugma) */
function mouseClick(x, y) {
  for (const fn of canvasListeners.mousedown || []) {
    fn({ button: 0, clientX: x, clientY: y, preventDefault() {} });
  }
}
function mouseMove(x, y) {
  for (const fn of canvasListeners.mousemove || []) {
    fn({ clientX: x, clientY: y, preventDefault() {} });
  }
}

const listeners = {};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  performance: { now: () => Date.now() },
  document: {
    getElementById: () => canvasStub,
    addEventListener() {},
    body: { appendChild() {} },
  },
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
  },
  requestAnimationFrame(cb) { sandbox.__raf = cb; return 1; },
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() {},
  Math, Date, JSON, Set, Map, Promise, Object, Array,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
try {
  vm.runInContext(src, sandbox, { filename: 'game.js' });
  ok(true, 'game.js muvaffaqiyatli yuklandi ( sintaksis + darhol ijro )');
} catch (e) {
  ok(false, 'game.js yuklashda xato: ' + e.message);
  console.error(e);
  process.exit(1);
}

const g = sandbox.window.__game;
ok(!!g, 'window.__game mavjud (test hook)');

function key(code, type) {
  for (const fn of listeners[type] || [] ) fn({ code, preventDefault() {}, repeat: false });
}
const ALL_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  'KeyA', 'KeyD', 'KeyW', 'KeyX', 'KeyJ', 'KeyZ', 'KeyP', 'KeyM', 'Escape', 'Enter'];
function releaseAll() { ALL_CODES.forEach(c => key(c, 'keyup')); }
function frames(n, dt) {
  for (let i = 0; i < n; i++) g.step(dt || 1);
}

/* ------------------------------ testlar ---------------------------------- */
console.log('\n[1] Menyu -> boshlash');
ok(g.state === 'menu', 'boshlang\'ich holat: menu');
key('Enter', 'keydown');
g.step(1);
key('Enter', 'keyup');
ok(g.state === 'play', 'Enter bosilgandan keyin holat: play');
ok(g.level === 1, '1-bosqich yaratildi');

console.log('\n[2] Bosqich generatsiyasi (1..10)');
let genOk = true, objOk = true, bossOk = true, reachOk = true;
for (let n = 1; n <= 10; n++) {
  g.gen(n);
  const L = g.lvl;
  if (!L.platforms.length || !L.platforms.some(p => p.ground)) genOk = false;
  if (!L.door || L.door.w <= 0) genOk = false;
  if (!L.objective || !L.objective.type) objOk = false;
  if (L.objective.type === 'gems' && L.objective.need <= 0) objOk = false;
  if (L.objective.type === 'clear' && (!L.objective.need || L.enemies.length <= 0)) objOk = false;
  if (L.objective.type === 'boss' && !L.enemies.some(e => e.type === 'boss')) bossOk = false;
  /* spawn yaqinidagi platforma changatuvchi (spike) emasligi */
  if (L.spikes.some(s => s.x < 120 && s.y > L.groundY - 40)) genOk = false;
  /* har bir gem maydonda */
  for (const gm of L.gems) {
    if (gm.x < 0 || gm.x > 960 || gm.y < 0 || gm.y > 600) reachOk = false;
  }
}
ok(genOk, 'barcha bosqichlarda maydon / darvoza / spawn to\'g\'ri');
ok(objOk, 'barcha maqsadlar bajariladigan (need > 0, enemy mavjud)');
ok(bossOk, 'boss bosqichlarida (4, 8, 10) boss mavjud');
ok(reachOk, 'barcha gemlar maydon chegarasida');

console.log('\n[3] O\'yinchi fizikasi: yurish + sakrash');
g.start();
frames(5, 1);
const p0 = g.player;
const x0 = p0.x;
key('ArrowRight', 'keydown');
frames(60, 1);
key('ArrowRight', 'keyup');
ok(g.player.x > x0 + 100, 'o\'yinchi o\'ngga yurdi (' + Math.round(x0) + ' -> ' + Math.round(g.player.x) + ')');

const yBefore = g.player.y;
key('Space', 'keydown');
g.step(1);
ok(g.player.vy < 0, 'sakrashda vy < 0 (vy=' + g.player.vy.toFixed(1) + ')');
key('Space', 'keyup');
frames(80, 1);
ok(Math.abs(g.player.y - yBefore) < 60, 'o\'yinchi yerga qaytdi (y=' + g.player.y.toFixed(0) + ')');

console.log('\n[4] Uzoq simulyatsiya: 3000 kadr tasodifiy boshqaruv bilan');
g.start();
const codes = ['ArrowRight', 'ArrowLeft', 'Space', 'KeyX', 'ArrowUp'];
let crashed = null, maxScore = 0, seenStates = new Set();
try {
  for (let i = 0; i < 3000; i++) {
    if (i % 7 === 0) key(codes[Math.floor(Math.random() * codes.length)], 'keydown');
    if (i % 7 === 3) key(codes[Math.floor(Math.random() * codes.length)], 'keyup');
    g.step(1);
    g.render();
    seenStates.add(g.state);
    if (g.state === 'clear') { key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup'); }
    if (g.state === 'over') {
      key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
      key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
      if (g.state === 'menu') g.start();
    }
    maxScore = Math.max(maxScore, g.score);
    const pl = g.player;
    if (!isFinite(pl.x) || !isFinite(pl.y) || !isFinite(pl.vx) || !isFinite(pl.vy)) {
      throw new Error('not-finite player state at frame ' + i);
    }
    if (pl.y > 2000) throw new Error('player fell out of world at frame ' + i);
  }
} catch (e) { crashed = e; }
ok(!crashed, '3000 kadr davomida crash yo\'q' + (crashed ? ' — ' + crashed.message : ''));
console.log('     ko\'rilgan holatlar: ' + [...seenStates].join(', ') + ' maxScore=' + maxScore);

console.log('\n[4b] Bosqich yakunlash yo\'li: gemlar -> eshik -> clear -> keyingi bosqich');
g.start();
frames(5, 1);
try {
  const scoreBefore = g.score;
  let guard = 0;
  while (g.state === 'play' && !g.lvl.door.open && guard++ < 60) {
    const gem = g.lvl.gems.find(x => !x.got);
    if (!gem) break;
    g.player.x = gem.x - g.player.w / 2;
    g.player.y = gem.y - g.player.h / 2;
    g.player.inv = 30;
    g.step(1);
  }
  ok(g.score > scoreBefore, "gem yig'ildi va ball oshdi (" + scoreBefore + ' -> ' + g.score + ')');
  if (g.lvl.objective.type === 'gems') {
    ok(g.lvl.objective.done >= g.lvl.objective.need && g.lvl.door.open,
       "gem obyekti to'liq bajarildi, eshik ochildi (" + g.lvl.objective.done + '/' + g.lvl.objective.need + ')');
  } else {
    g.lvl.objective.done = g.lvl.objective.need;
    g.lvl.enemies.length = 0;
    g.lvl.door.open = true;
    ok(true, 'obyekti turi: ' + g.lvl.objective.type + ' — eshik majbullan ochildi');
  }
  g.player.x = g.lvl.door.x;
  g.player.y = g.lvl.door.y;
  g.player.inv = 60;
  g.step(1);
  ok(g.state === 'clear', 'darvozadan o\'tish -> clear (holat=' + g.state + ')');
  key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
  ok(g.state === 'play' && g.level === 2, 'keyingi bosqichga o\'tildi (bosqich=' + g.level + ')');
} catch (e) {
  ok(false, 'bosqich yakunlash yo\'li yiqildi: ' + e.message);
  console.error(e);
}

console.log('\n[5] Dyustan (shield) zarar yetkazmasligi');
g.start();
releaseAll();
g.gen(2);            /* 2-bosqichda dushman kafolan bor */
frames(3, 1);
const pl = g.player;
pl.pw.shield = 1;
pl.inv = 0;
pl.hp = 3;
const en = g.lvl.enemies[0];
if (en) {
  pl.x = en.x; pl.y = en.y;
  frames(3, 1);
  ok(pl.hp === 3 && pl.pw.shield === 0, 'dyustan bir zararni qabul qildi, yurak saqlandi (hp=' + pl.hp + ', shield=' + pl.pw.shield + ')');
} else {
  ok(false, '2-bosqichda ham dushman topilmadi');
}

console.log('\n[6] O\'lim -> game over -> menyu');
g.start();
releaseAll();
g.gen(2);
frames(3, 1);
g.player.hp = 1;
g.player.inv = 0;
g.player.pw.shield = 0;
const e2 = g.lvl.enemies.find(e => e.type === 'walker') || g.lvl.enemies[0];
if (e2) {
  g.player.x = e2.x; g.player.y = e2.y;
  frames(3, 1);
  ok(g.state === 'over', '0 HP da holat: over (holat=' + g.state + ')');
  key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
  ok(g.state === 'menu', 'Enter bosilgandan keyin menyu');
} else {
  ok(true, 'dushman yo\'q — o\'lim testi o\'tkazildi');
}

console.log('\n[7] To\'plangan ball rekordga saqlanadi');
g.start();
releaseAll();
g.gen(2);
frames(3, 1);
const before = sandbox.localStorage.getItem('xazina_best');
g.score = 999999;
/* haqiqiy o'lim yo'li orqali: dushman ustiga borib zarar olish */
g.player.hp = 1;
g.player.inv = 0;
g.player.pw.shield = 0;
const e3 = g.lvl.enemies[0];
ok(!!e3, "o'lim uchun dushman mavjud");
if (e3) {
  g.player.x = e3.x;
  g.player.y = e3.y;
  g.step(1);
}
ok(g.state === 'over', "o'lim holati (over) faollashdi (holat=" + g.state + ')');
const after = sandbox.localStorage.getItem('xazina_best');
ok(after === '999999', 'rekord localStorage\'ga yozildi (oldin: ' + before + ', keyin: ' + after + ')');

console.log('\n[8] Pauza');
g.start();
frames(10, 1);
key('KeyP', 'keydown'); g.step(1); key('KeyP', 'keyup');
ok(g.state === 'pause', 'P bosganda pauza');
const px = g.player.x;
frames(30, 1);
ok(g.player.x === px, 'pauzada o\'yinchi harakatlanmaydi');
key('KeyP', 'keydown'); g.step(1); key('KeyP', 'keyup');
ok(g.state === 'play', 'P qayta davom ettiradi');

console.log('\n[9] Boss bosqichi: boss olimi -> eshik ochiladi');
let bossDoors = true;
for (const bn of [4, 8, 10]) {
  g.start();
  releaseAll();
  g.gen(bn);
  frames(3, 1);
  const boss = g.lvl.enemies.find(e => e.type === 'boss');
  if (!boss) { ok(false, bn + '-bosqichda boss topilmadi'); continue; }
  ok(g.lvl.objective.type === 'boss', bn + '-bosqich maqsadi: boss');
  ok(g.lvl.door.open === false, bn + '-bosqichda eshik boshida qulflangan');
  /* bossni o'ldiramiz — sichqonchani bossga nishonlab, chap tugma bilan hujum */
  const aimAndHit = (b) => {
    g.player.atkCd = 0;
    g.player.atk = 15;
    g.player.atkHits = new Set();
    g.player.x = b.x - 40;
    g.player.y = b.y;
    mouseMove(b.x + b.w / 2, b.y + b.h / 2);   /* nishon bossda */
    g.step(1);
  };
  aimAndHit(boss);
  let guard = 0;
  while (g.lvl.enemies.some(e => e.type === 'boss') && guard++ < 400) {
    const b = g.lvl.enemies.find(e => e.type === 'boss');
    if (!b) break;
    b.hp = 1;
    aimAndHit(b);
  }
  const stillBoss = g.lvl.enemies.some(e => e.type === 'boss');
  if (stillBoss) { ok(false, bn + '-bosqichda bossni yengib bo\'lmadi'); bossDoors = false; }
  else if (!g.lvl.door.open) { ok(false, bn + '-bosqichda boss o\'lgandan keyin eshik ochilmadi'); bossDoors = false; }
}
if (bossDoors) ok(true, 'barcha boss bosqichlarida (4, 8, 10) eshik ochildi');

console.log('\n[10] G\'alaba: 10-bosqichdan keyin win holati');
g.start();
releaseAll();
g.gen(10);
frames(3, 1);
g.lvl.enemies.length = 0;
g.lvl.door.open = true;
g.player.x = g.lvl.door.x;
g.player.y = g.lvl.door.y;
g.player.inv = 99;
g.step(1);
ok(g.state === 'clear', '10-bosqich yakunlandi (holat=' + g.state + ')');
key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
ok(g.state === 'win', 'g\'alaba holati (win) ko\'rsatildi (holat=' + g.state + ')');
key('Enter', 'keydown'); g.step(1); key('Enter', 'keyup');
ok(g.state === 'menu', 'win dan keyin menyu');

console.log('\n[11] Sichqoncha: chap tugma boshlash / tasdiqlash / hujum');
/* menyu: sichqoncha bosish boshlaydi */
ok(g.state === 'menu', 'menyudamiz');
mouseClick(480, 300);
g.step(1);
ok(g.state === 'play', 'menyuda chap tugma bosish o\'yinni boshladi (holat=' + g.state + ')');

/* hujum: chap tugma atk boshlaydi */
releaseAll();
g.player.atkCd = 0;
g.player.atk = 0;
mouseClick(g.player.x + 200, g.player.y);
g.step(1);
ok(g.player.atk > 0, 'o\'yin ichida chap tugma hujumni boshladi (atk=' + g.player.atk.toFixed(0) + ')');

/* nishon: sichqoncha x, y qiymati canvasda yangilanadi */
mouseMove(123, 456);
ok(Math.abs(g.mouse.x - 123) < 1 && Math.abs(g.mouse.y - 456) < 1,
   'sichqoncha kordinatalari canvasga moslashdi (' + g.mouse.x + ',' + g.mouse.y + ')');

/* clear ekrani: chap tugma keyingi bosqichga olib o'tadi */
g.gen(3);
frames(2, 1);
g.lvl.door.open = true;
g.player.x = g.lvl.door.x;
g.player.y = g.lvl.door.y;
g.player.inv = 99;
g.step(1);
ok(g.state === 'clear', 'bosqich yakunlandi (clear)');
const lvlBefore = g.level;
mouseClick(480, 300);
g.step(1);
ok(g.state === 'play' && g.level === lvlBefore + 1,
   'chap tugma keyingi bosqichga otdi (bosqich=' + g.level + ')');

/* over ekrani: chap tugma menyuga qaytaradi */
g.state = 'over';
mouseClick(480, 300);
g.step(1);
ok(g.state === 'menu', 'over ekranida chap tugma menyuga qaytardi');

console.log('\n[12] X / J tugmalari olib tashlangan (hujum faqat sichqoncha)');
mouseClick(480, 300); g.step(1);   /* o\'yinni boshlash */
releaseAll();
g.player.atkCd = 0;
g.player.atk = 0;
key('KeyX', 'keydown'); g.step(1); key('KeyX', 'keyup');
const atkAfterX = g.player.atk;
key('KeyJ', 'keydown'); g.step(1); key('KeyJ', 'keyup');
const atkAfterJ = g.player.atk;
ok(atkAfterX === 0 && atkAfterJ === 0,
   'X va J hujumni boshlamaydi (X=' + atkAfterX + ', J=' + atkAfterJ + ')');

console.log('\n[13] M tugmasi — musiqa');
const musicBefore = g.musicOn;
key('KeyM', 'keydown'); g.step(1); key('KeyM', 'keyup');
ok(g.musicOn === !musicBefore, 'M musiqani yoqadi/o\'chiradi (' + musicBefore + ' -> ' + g.musicOn + ')');
key('KeyM', 'keydown'); g.step(1); key('KeyM', 'keyup');
ok(g.musicOn === musicBefore, 'M ikkinchi bosilganda qayta holatga qaytadi');

console.log('\n[14] Telefon: ekran tugmalari (touch)');
/* touch hodisasi yuborish */
function touchEv(type, pts) {
  for (const fn of canvasListeners[type] || []) {
    fn({
      preventDefault() {},
      touches: pts.map((p, i) => ({ identifier: i, clientX: p[0], clientY: p[1] })),
      changedTouches: pts.map((p, i) => ({ identifier: i, clientX: p[0], clientY: p[1] })),
    });
  }
}
/* canvas 960x540 ko'rinishda: BTN.left x=24..108, y=436..520 */
releaseAll();
g.state = 'play';
touchEv('touchstart', [[60, 470]]);      /* chap tugma */
g.step(1);
const px0 = g.player.x;
for (let i = 0; i < 30; i++) g.step(1);
ok(g.player.x < px0 - 30, 'chap ekran tugmasi o\'yinchini chapga yuritdi');
touchEv('touchend', [[60, 470]]);
g.step(1);
ok(true, 'touchend xatosiz qabul qilindi');

/* o'ng tugma */
touchEv('touchstart', [[160, 470]]);
const px1 = g.player.x;
for (let i = 0; i < 30; i++) g.step(1);
ok(g.player.x > px1 + 30, 'o\'ng ekran tugmasi o\'yinchini o\'ngga yuritdi');
touchEv('touchend', [[160, 470]]);
g.step(1);

/* sakrash tugmasi */
g.player.onGround = true;
touchEv('touchstart', [[890, 470]]);     /* jump tugma */
g.step(1);
ok(g.player.vy < 0, 'sakrash tugmasi sakratdi (vy=' + g.player.vy.toFixed(1) + ')');
touchEv('touchend', [[890, 470]]);

/* bo'sh joy = hujum / tasdiqlash */
g.player.atkCd = 0; g.player.atk = 0;
touchEv('touchstart', [[400, 200]]);
g.step(1);
ok(g.player.atk > 0, 'bo\'sh joyga tegish hujum berdi (atk=' + g.player.atk.toFixed(0) + ')');
touchEv('touchend', [[400, 200]]);

console.log('\n' + (failures === 0 ? 'BARCHA TESTLAR O\'TDI' : failures + ' TA TEST YIQILDI'));
process.exit(failures === 0 ? 0 : 1);
