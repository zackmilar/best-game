// enemies.js — the void motes and the Hollow Star.
// Pure behaviour: each mote is a plain object; these functions create
// them, steer them, and run the boss's attacks. Drawing lives in
// render.js; collisions live in world.js.

import { BOSS, MOTE, PALETTE } from './config.js';
import { range } from './random.js';

export function makeMote(random, kind, x, y) {
  const tuning = MOTE[kind];
  const mote = {
    kind,
    x,
    y,
    radius: tuning.radius,
    hp: tuning.hp,
    maxHp: tuning.hp,
    speed: kind === 'drifter' ? range(random, MOTE.drifter.speedMin, MOTE.drifter.speedMax) : tuning.speed,
    angle: random() * Math.PI * 2,
    wobblePhase: random() * Math.PI * 2,
    wobbleSpeed: 1.5 + random() * 1.5,
    state: 'drift',
    stateTime: 0,
    lungeCooldown: 1 + random(),
    fireTimer: range(random, 1, MOTE.spitter.fireInterval),
    pulse: random() * Math.PI * 2,
    golden: kind === 'golden',
    flash: 0,
  };
  return mote;
}

export function makeBoss(random, draftsTaken) {
  return {
    kind: 'boss',
    x: 640,
    y: 180,
    radius: BOSS.radius,
    hp: BOSS.hp + BOSS.hpPerDraft * draftsTaken,
    maxHp: BOSS.hp + BOSS.hpPerDraft * draftsTaken,
    angle: 0,
    orbitRadius: BOSS.orbitRadius,
    burstTimer: 2.0,
    trickleTimer: BOSS.trickleInterval,
    spawnedAdds: [false, false],
    flash: 0,
    roarPlayed: false,
  };
}

// Steer one mote for a step. Returns 'orb' when a spitter fires, so the
// world can spawn the projectile — enemies never mutate the world.
export function steerMote(mote, dt, player, random) {
  mote.pulse += dt * 4;
  if (mote.flash > 0) mote.flash -= dt;
  const dx = player.x - mote.x;
  const dy = player.y - mote.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (mote.kind === 'drifter' || mote.kind === 'golden') {
    mote.wobblePhase += dt * mote.wobbleSpeed;
    const wobble = Math.sin(mote.wobblePhase) * 0.6;
    mote.angle += wobble * dt;
    mote.x += Math.cos(mote.angle) * mote.speed * dt;
    mote.y += Math.sin(mote.angle) * mote.speed * dt;
    // A golden mote crosses the arena once and leaves: it is a chase,
    // not a resident. Drifters bounce off the walls instead.
    if (mote.kind === 'golden') return null;
    if (mote.x < 30 || mote.x > 1250) mote.angle = Math.PI - mote.angle;
    if (mote.y < 30 || mote.y > 690) mote.angle = -mote.angle;
    mote.x = Math.max(24, Math.min(1256, mote.x));
    mote.y = Math.max(24, Math.min(696, mote.y));
    return null;
  }

  if (mote.kind === 'darter') {
    mote.stateTime += dt;
    if (mote.state === 'drift') {
      mote.x += (dx / distance) * mote.speed * dt;
      mote.y += (dy / distance) * mote.speed * dt;
      mote.lungeCooldown -= dt;
      if (mote.lungeCooldown <= 0 && distance < 420) {
        mote.state = 'telegraph';
        mote.stateTime = 0;
      }
    } else if (mote.state === 'telegraph') {
      if (mote.stateTime >= MOTE.darter.telegraphSeconds) {
        mote.state = 'lunge';
        mote.stateTime = 0;
        mote.lungeAngle = Math.atan2(dy, dx);
      }
    } else if (mote.state === 'lunge') {
      mote.x += Math.cos(mote.lungeAngle) * MOTE.darter.lungeSpeed * dt;
      mote.y += Math.sin(mote.lungeAngle) * MOTE.darter.lungeSpeed * dt;
      if (mote.stateTime >= MOTE.darter.lungeSeconds) {
        mote.state = 'drift';
        mote.stateTime = 0;
        mote.lungeCooldown = MOTE.darter.lungeCooldown;
      }
    }
    mote.x = Math.max(24, Math.min(1256, mote.x));
    mote.y = Math.max(24, Math.min(696, mote.y));
    return null;
  }

  if (mote.kind === 'spitter') {
    if (distance < MOTE.spitter.keepMin) {
      mote.x -= (dx / distance) * mote.speed * dt;
      mote.y -= (dy / distance) * mote.speed * dt;
    } else if (distance > MOTE.spitter.keepMax) {
      mote.x += (dx / distance) * mote.speed * dt;
      mote.y += (dy / distance) * mote.speed * dt;
    } else {
      mote.x += Math.cos(mote.wobblePhase + mote.pulse) * mote.speed * 0.4 * dt;
      mote.y += Math.sin(mote.wobblePhase + mote.pulse) * mote.speed * 0.4 * dt;
    }
    mote.fireTimer -= dt;
    if (mote.fireTimer <= 0) {
      mote.fireTimer = MOTE.spitter.fireInterval;
      return 'orb';
    }
    mote.x = Math.max(24, Math.min(1256, mote.x));
    mote.y = Math.max(24, Math.min(696, mote.y));
    return null;
  }
  return null;
}

// Boss orbit + attacks. Returns an event object the world acts on:
// { burst: true } for a radial volley, { spawnAdds: n } at HP gates.
export function steerBoss(boss, dt, player, random) {
  if (boss.flash > 0) boss.flash -= dt;
  boss.angle += (BOSS.orbitSpeed / boss.orbitRadius) * dt;
  const centreX = 640;
  const centreY = 360;
  boss.x = centreX + Math.cos(boss.angle) * boss.orbitRadius;
  boss.y = centreY + Math.sin(boss.angle) * boss.orbitRadius * 0.7;
  boss.burstTimer -= dt;
  const event = {};
  if (boss.burstTimer <= 0) {
    boss.burstTimer = BOSS.burstInterval;
    event.burst = true;
  }
  const fraction = boss.hp / boss.maxHp;
  BOSS.addSpawnHpFractions.forEach((gate, index) => {
    if (!boss.spawnedAdds[index] && fraction <= gate) {
      boss.spawnedAdds[index] = true;
      event.spawnAdds = BOSS.addsPerSpawn;
    }
  });
  boss.trickleTimer -= dt;
  if (boss.trickleTimer <= 0) {
    boss.trickleTimer = BOSS.trickleInterval;
    event.trickle = true;
  }
  return event;
}

export function bossRadialBurst(boss) {
  const orbs = [];
  for (let i = 0; i < BOSS.burstOrbs; i += 1) {
    const angle = (i / BOSS.burstOrbs) * Math.PI * 2 + boss.angle;
    orbs.push({
      x: boss.x + Math.cos(angle) * (boss.radius + 8),
      y: boss.y + Math.sin(angle) * (boss.radius + 8),
      vx: Math.cos(angle) * MOTE.spitter.orbSpeed,
      vy: Math.sin(angle) * MOTE.spitter.orbSpeed,
      radius: MOTE.spitter.orbRadius,
    });
  }
  return orbs;
}

export function moteColour(kind) {
  if (kind === 'drifter') return PALETTE.drifter;
  if (kind === 'darter') return PALETTE.darter;
  if (kind === 'spitter') return PALETTE.spitter;
  if (kind === 'golden') return PALETTE.golden;
  return PALETTE.boss;
}
