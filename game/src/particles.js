// particles.js — juice, kept out of the simulation: burst shards,
// floating score text, screen shake, and hit-stop. The world never
// reads these; render reads them. All lists are fixed pools reused in
// place so the loop allocates nothing.

import { PALETTE } from './config.js';

const MAX_SHARDS = 240;
const MAX_TEXTS = 32;

export function createParticles() {
  const particles = {
    shards: [],
    texts: [],
    shakeTime: 0,
    shakeStrength: 0,
    hitStopTime: 0,
    time: 0,
  };
  for (let i = 0; i < MAX_SHARDS; i += 1) {
    particles.shards.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, colour: '#ffffff' });
  }
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    particles.texts.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', colour: '#ffffff', size: 18 });
  }
  return particles;
}

export function spawnBurst(particles, x, y, colour, count, speed) {
  let spawned = 0;
  for (const shard of particles.shards) {
    if (spawned >= count) break;
    if (shard.alive) continue;
    const angle = (spawned / count) * Math.PI * 2 + (x + y) * 0.001;
    const velocity = speed * (0.5 + ((spawned * 37) % 10) / 20);
    shard.alive = true;
    shard.x = x;
    shard.y = y;
    shard.vx = Math.cos(angle) * velocity;
    shard.vy = Math.sin(angle) * velocity;
    shard.life = 0;
    shard.maxLife = 0.5 + ((spawned * 13) % 10) / 25;
    shard.size = 2 + ((spawned * 7) % 4);
    shard.colour = colour;
    spawned += 1;
  }
}

export function spawnFloatingText(particles, x, y, text, colour, size = 18) {
  for (const item of particles.texts) {
    if (item.alive) continue;
    item.alive = true;
    item.x = x;
    item.y = y;
    item.life = 0;
    item.maxLife = 0.9;
    item.text = text;
    item.colour = colour || PALETTE.starlight;
    item.size = size;
    return;
  }
}

export function addShake(particles, strength, seconds) {
  // Cap the strength so a boss pop and a mote pop in the same frame
  // do not stack into a nauseating jolt.
  particles.shakeStrength = Math.min(14, Math.max(particles.shakeStrength, strength));
  particles.shakeTime = Math.max(particles.shakeTime, seconds);
}

export function addHitStop(particles, seconds) {
  particles.hitStopTime = Math.max(particles.hitStopTime, seconds);
}

export function updateParticles(particles, dt) {
  particles.time += dt;
  if (particles.hitStopTime > 0) particles.hitStopTime -= dt;
  if (particles.shakeTime > 0) {
    particles.shakeTime -= dt;
    if (particles.shakeTime <= 0) particles.shakeStrength = 0;
  }
  for (const shard of particles.shards) {
    if (!shard.alive) continue;
    shard.life += dt;
    if (shard.life >= shard.maxLife) { shard.alive = false; continue; }
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    shard.vx *= 0.96;
    shard.vy *= 0.96;
  }
  for (const item of particles.texts) {
    if (!item.alive) continue;
    item.life += dt;
    if (item.life >= item.maxLife) { item.alive = false; continue; }
    item.y -= 42 * dt;
  }
}

// Shake offset for this frame: deterministic wobble from particle time,
// so a staged screenshot shakes the same way every run.
export function shakeOffset(particles) {
  if (particles.shakeTime <= 0) return { x: 0, y: 0 };
  const s = particles.shakeStrength;
  const t = particles.time * 61;
  return { x: Math.sin(t * 1.7) * s, y: Math.cos(t * 2.3) * s };
}

export function drawParticles(context, particles) {
  for (const shard of particles.shards) {
    if (!shard.alive) continue;
    const alpha = 1 - shard.life / shard.maxLife;
    context.globalAlpha = alpha;
    context.fillStyle = shard.colour;
    context.fillRect(shard.x - shard.size / 2, shard.y - shard.size / 2, shard.size, shard.size);
  }
  context.globalAlpha = 1;
  for (const item of particles.texts) {
    if (!item.alive) continue;
    const alpha = 1 - item.life / item.maxLife;
    context.globalAlpha = alpha;
    context.fillStyle = item.colour;
    context.font = `bold ${item.size}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.fillText(item.text, item.x, item.y);
  }
  context.globalAlpha = 1;
}
