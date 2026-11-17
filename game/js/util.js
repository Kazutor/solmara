// SOLMARA utility helpers: seeded random numbers, math, and save handling.
// Everything here is original code written for this game.
(function () {
  "use strict";

  // Deterministic random generator (mulberry32) so the city and the
  // screenshot modes always build the same world from the same seed.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  // Shortest signed difference between two angles.
  function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function fmtMoney(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  // Circle vs axis-aligned rectangle push-out. Returns true when overlapping.
  function circleRectPush(px, py, r, rect) {
    const cx = clamp(px, rect.x, rect.x + rect.w);
    const cy = clamp(py, rect.y, rect.y + rect.h);
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return null;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
    }
    // Centre inside the rectangle: push out along the smallest axis.
    const left = px - rect.x;
    const right = rect.x + rect.w - px;
    const top = py - rect.y;
    const bottom = rect.y + rect.h - py;
    const min = Math.min(left, right, top, bottom);
    if (min === left) return { x: -(left + r), y: 0 };
    if (min === right) return { x: right + r, y: 0 };
    if (min === top) return { x: 0, y: -(top + r) };
    return { x: 0, y: bottom + r };
  }

  const SAVE_KEY = "solmara-save-v1";

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function storeSave(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  window.SOL = {
    makeRng: makeRng,
    clamp: clamp,
    lerp: lerp,
    dist: dist,
    angleTo: angleTo,
    angleDiff: angleDiff,
    pick: pick,
    fmtMoney: fmtMoney,
    fmtTime: fmtTime,
    circleRectPush: circleRectPush,
    loadSave: loadSave,
    storeSave: storeSave,
    SAVE_KEY: SAVE_KEY,
  };
})();
