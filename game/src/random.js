// random.js — a small seeded generator so a run (and a screenshot
// staged with ?shot=&seed=) plays out exactly the same way every time.
// Mulberry32: short, fast, and deterministic for any 32-bit seed.
// Nothing in the game may call Math.random() — route all chance here.

export function makeSeededRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function pickFrom(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function shuffleCopy(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const held = copy[i];
    copy[i] = copy[j];
    copy[j] = held;
  }
  return copy;
}
