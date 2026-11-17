// world.js — the simulation. State, waves, spawning, combo, draft,
// collisions. No drawing here: render.js reads this state and draws it.
// Everything runs on the fixed 1/60 s step from main.js, driven by the
// seeded RNG, so the same seed plays the same way every time.

import { BLESSINGS, BOSS, COMBO, FIELD, MOTE, PLAYER, WAVES } from './config.js';
import { makeBoss, makeMote, steerBoss, steerMote, bossRadialBurst } from './enemies.js';
import { addHitStop, addShake } from './particles.js';
import { pickFrom, range, shuffleCopy } from './random.js';

export function createWorld(random) {
  return {
    random,
    screen: 'title',
    wave: 0,
    time: 0,
    runTime: 0,
    score: 0,
    best: 0,
    motesPopped: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 1,
    comboTimer: 0,
    comboChain: 0,
    player: {
      x: FIELD.width / 2,
      y: FIELD.height / 2 + 120,
      vx: 0,
      vy: 0,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashAngle: 0,
      dashTrail: [],
      fireTimer: 0,
      aimX: FIELD.width / 2,
      aimY: 200,
    },
    motes: [],
    boss: null,
    bullets: [],
    orbs: [],
    shards: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnedCount: 0,
    waveTotal: 0,
    breatherTimer: 0,
    draftChoices: [],
    draftsTaken: 0,
    blessings: { spread: 0, boots: 0, magnet: 0, ward: 0, rapid: 0, echo: 0 },
    banner: '',
    bannerTimer: 0,
    hintTimer: 5,
    goldenSpawnedThisWave: false,
    victory: false,
    newBest: false,
    endStats: null,
  };
}

export function startRun(world, audio) {
  const fresh = createWorld(world.random);
  fresh.best = world.best;
  Object.assign(world, fresh);
  world.screen = 'play';
  world.best = fresh.best;
  startWave(world, 1, audio);
}

export function startWave(world, waveNumber, audio) {
  world.wave = waveNumber;
  world.spawnedCount = 0;
  world.spawnTimer = 0.5;
  world.goldenSpawnedThisWave = false;
  const spec = WAVES[waveNumber - 1];
  if (waveNumber === 5) {
    world.boss = makeBoss(world.random, world.draftsTaken);
    world.waveTotal = 0;
    world.spawnQueue = [];
    world.banner = 'WAVE 5 — THE HOLLOW STAR';
    if (audio) audio.playBossRoar();
  } else {
    world.boss = null;
    world.waveTotal = spec.drifters + spec.darters + spec.spitters;
    const kinds = [];
    for (let i = 0; i < spec.drifters; i += 1) kinds.push('drifter');
    for (let i = 0; i < spec.darters; i += 1) kinds.push('darter');
    for (let i = 0; i < spec.spitters; i += 1) kinds.push('spitter');
    world.spawnQueue = shuffleCopy(world.random, kinds);
    world.banner = `WAVE ${waveNumber}`;
  }
  world.bannerTimer = 1.6;
  if (audio) audio.playWaveHorn();
}

// Dash cooldown after blessings: Dash Echo cuts it 40% (2.5 s -> 1.5 s).
// render.js reads this for the cooldown ring; startDash uses it too.
export function dashCooldownSeconds(world) {
  return PLAYER.dashCooldown * (world.blessings.echo > 0 ? 0.6 : 1);
}

function spawnEdgePoint(world) {
  const random = world.random;
  const side = Math.floor(random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) { x = range(random, 40, FIELD.width - 40); y = 36; }
  else if (side === 1) { x = range(random, 40, FIELD.width - 40); y = FIELD.height - 36; }
  else if (side === 2) { x = 36; y = range(random, 40, FIELD.height - 40); }
  else { x = FIELD.width - 36; y = range(random, 40, FIELD.height - 40); }
  // Never spawn on top of the player: nudge the point around the edge.
  if (Math.hypot(x - world.player.x, y - world.player.y) < MOTE.minSpawnDistanceFromPlayer) {
    x = FIELD.width - x;
    y = FIELD.height - y;
  }
  return { x, y };
}

export function spawnMote(world, kind) {
  if (world.motes.length >= MOTE.maxAlive) return null;
  const point = spawnEdgePoint(world);
  const mote = makeMote(world.random, kind, point.x, point.y);
  world.motes.push(mote);
  return mote;
}

function spawnGoldenMote(world) {
  if (world.goldenSpawnedThisWave) return;
  world.goldenSpawnedThisWave = true;
  const point = spawnEdgePoint(world);
  const mote = makeMote(world.random, 'golden', point.x, point.y);
  mote.angle = Math.atan2(world.player.y - point.y, world.player.x - point.x);
  world.motes.push(mote);
}

export function spawnWave(world, audio) {
  // Kept as the public name for the wave kick-off; startWave does the work.
  startWave(world, world.wave + 1, audio);
}

function firePlayerShot(world) {
  const player = world.player;
  const spreadCount = 1 + world.blessings.spread;
  const baseAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  for (let i = 0; i < spreadCount; i += 1) {
    const offset = (i - (spreadCount - 1) / 2) * (10 * Math.PI / 180);
    const angle = baseAngle + offset;
    world.bullets.push({
      x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
      y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      damage: PLAYER.bulletDamage,
    });
  }
  world.shotsFired += spreadCount;
}

function startDash(world) {
  const player = world.player;
  if (player.dashCooldown > 0 || player.dashTime > 0) return false;
  const move = world.lastMove || { x: 0, y: -1 };
  const length = Math.hypot(move.x, move.y) || 1;
  player.dashAngle = Math.atan2(move.y / length, move.x / length);
  player.dashTime = PLAYER.dashSeconds;
  player.dashCooldown = dashCooldownSeconds(world);
  player.invulnerable = Math.max(player.invulnerable, PLAYER.dashInvulnerableSeconds);
  player.dashTrail = [{ x: player.x, y: player.y }];
  return true;
}

export function dashPlayer(world) {
  return startDash(world);
}

function hurtPlayer(world, damage, fromX, fromY, audio, particles) {
  const player = world.player;
  if (player.invulnerable > 0 || world.screen !== 'play') return;
  player.hp -= damage;
  player.invulnerable = PLAYER.hurtInvulnerableSeconds;
  const angle = Math.atan2(player.y - fromY, player.x - fromX);
  // Knockback is the full config value (120 px), not a scaled fraction.
  player.x += Math.cos(angle) * PLAYER.knockback;
  player.y += Math.sin(angle) * PLAYER.knockback;
  player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
  player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));
  world.combo = 1;
  world.comboChain = 0;
  world.comboTimer = 0;
  if (audio) audio.playHurt();
  if (particles) addShake(particles.state, 6, 0.2);
  if (player.hp <= 0) endRun(world, false, audio);
}

export function popMote(world, mote, particles, audio) {
  const index = world.motes.indexOf(mote);
  if (index === -1) return;
  world.motes.splice(index, 1);
  world.motesPopped += 1;
  const now = world.time;
  if (now - world.comboTimer <= comboWindow(world) || world.comboChain === 0) {
    world.comboChain += 1;
  } else {
    world.comboChain = 1;
  }
  world.comboTimer = now;
  world.combo = Math.min(COMBO.maxMultiplier, Math.max(1, world.comboChain));
  const points = mote.golden ? COMBO.goldenPoints : COMBO.basePoints * world.combo;
  world.score += points;
  if (particles) {
    const { spawnBurst, spawnFloatingText } = particles.helpers;
    spawnBurst(particles.state, mote.x, mote.y, mote.golden ? '#ffd700' : '#b388ff', mote.golden ? 22 : 12, 260);
    spawnFloatingText(particles.state, mote.x, mote.y - 10, `+${points}`, mote.golden ? '#ffd700' : '#ffe066', mote.golden ? 24 : 18);
    // Shake scaled to the event: a golden pop jolts harder than a mote pop.
    addShake(particles.state, mote.golden ? 8 : 3, mote.golden ? 0.25 : 0.12);
  }
  if (audio) {
    if (mote.golden) audio.playGoldenPop();
    else audio.playPop(world.combo);
  }
  // Shards fly to the player as starlight — the magnet feel.
  for (let i = 0; i < 3; i += 1) {
    world.shards.push({ x: mote.x, y: mote.y, value: 0 });
  }
}

export function comboWindow(world) {
  return COMBO.windowSeconds + (world.blessings.magnet > 0 ? 1 : 0);
}

function endRun(world, victory, audio) {
  world.victory = victory;
  world.screen = victory ? 'victory' : 'gameover';
  if (!victory && audio) audio.playDefeat();
  const accuracy = world.shotsFired > 0 ? Math.round((world.shotsHit / world.shotsFired) * 100) : 0;
  world.endStats = {
    score: world.score,
    best: Math.max(world.best, world.score),
    waves: victory ? 5 : world.wave,
    motes: world.motesPopped,
    accuracy,
    time: world.runTime,
  };
  world.newBest = world.score > world.best;
  if (world.newBest) world.best = world.score;
  try {
    window.localStorage.setItem('starfall-keep.best', String(world.best));
  } catch (error) { /* storage unavailable — best score just lives this session */ }
}

export function offerDraft(world) {
  const pool = shuffleCopy(world.random, BLESSINGS);
  world.draftChoices = pool.slice(0, 3);
  world.screen = 'draft';
  world.banner = '';
}

export function draftBlessing(world, blessingId, audio) {
  const blessing = BLESSINGS.find((entry) => entry.id === blessingId);
  if (!blessing) return false;
  if (blessingId === 'ward') {
    world.player.maxHp += 1;
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + 1);
  }
  world.blessings[blessingId] += 1;
  world.draftsTaken += 1;
  world.draftChoices = [];
  world.banner = blessing.name.toUpperCase();
  world.bannerTimer = 1.4;
  if (audio) audio.playDraft();
  // The pick ends the draft: back to play, or the draft screen would
  // re-fire on an empty card row the next step.
  world.screen = 'play';
  startWave(world, world.wave + 1, audio);
  return true;
}

function updateBullets(world, particles, audio, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
      world.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const mote of world.motes.slice()) {
      if (Math.hypot(bullet.x - mote.x, bullet.y - mote.y) < bullet.radius + mote.radius) {
        world.shotsHit += 1;
        mote.hp -= bullet.damage;
        mote.flash = 0.12;
        hit = true;
        if (mote.hp <= 0) popMote(world, mote, particles, audio);
        break;
      }
    }
    if (!hit && world.boss) {
      const boss = world.boss;
      if (Math.hypot(bullet.x - boss.x, bullet.y - boss.y) < bullet.radius + boss.radius) {
        world.shotsHit += 1;
        boss.hp -= bullet.damage;
        boss.flash = 0.08;
        hit = true;
        // Boss hits land with weight: 40 ms hit-stop + a shake.
        if (particles) {
          addHitStop(particles.state, 0.04);
          addShake(particles.state, 4, 0.15);
        }
        if (boss.hp <= 0) {
          world.score += COMBO.bossPoints;
          world.boss = null;
          if (particles) {
            particles.helpers.spawnBurst(particles.state, boss.x, boss.y, '#ff5d8f', 60, 420);
            addShake(particles.state, 12, 0.4);
            addHitStop(particles.state, 0.04);
          }
          if (audio) audio.playVictory();
          endRun(world, true, audio);
          return;
        }
      }
    }
    if (hit) world.bullets.splice(i, 1);
  }
}

function updateOrbs(world, dt, audio, particles) {
  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const orb = world.orbs[i];
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    if (orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) {
      world.orbs.splice(i, 1);
      continue;
    }
    const player = world.player;
    if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.radius + PLAYER.radius - 2) {
      world.orbs.splice(i, 1);
      hurtPlayer(world, 1, orb.x, orb.y, audio, particles);
    }
  }
}

export function updateWorld(world, dt, input, particles, audio) {
  if (world.screen !== 'play') return;
  world.time += dt;
  world.runTime += dt;
  const player = world.player;

  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.hintTimer > 0) world.hintTimer -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.dashCooldown > 0) player.dashCooldown -= dt;

  // Combo decays when the window lapses.
  if (world.comboChain > 0 && world.time - world.comboTimer > comboWindow(world)) {
    world.combo = 1;
    world.comboChain = 0;
  }

  const move = input.moveVector();
  world.lastMove = (move.x !== 0 || move.y !== 0) ? move : world.lastMove;
  if (input.consumeDash() || input.wasPressed('KeyX')) {
    if (startDash(world) && audio) audio.playDash();
  }
  const speed = PLAYER.speed * (1 + 0.15 * world.blessings.boots);
  if (player.dashTime > 0) {
    player.dashTime -= dt;
    const dashSpeed = PLAYER.dashDistance / PLAYER.dashSeconds;
    player.x += Math.cos(player.dashAngle) * dashSpeed * dt;
    player.y += Math.sin(player.dashAngle) * dashSpeed * dt;
    player.dashTrail.push({ x: player.x, y: player.y });
    if (player.dashTrail.length > 10) player.dashTrail.shift();
    // Dash trail damages motes crossed.
    const trailDamage = world.blessings.echo > 0 ? 2 : PLAYER.dashTrailDamage;
    for (const mote of world.motes.slice()) {
      if (Math.hypot(player.x - mote.x, player.y - mote.y) < PLAYER.radius + mote.radius) {
        mote.hp -= trailDamage;
        if (mote.hp <= 0) popMote(world, mote, particles, audio);
      }
    }
  } else {
    player.x += move.x * speed * dt;
    player.y += move.y * speed * dt;
  }
  player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
  player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));

  const aim = input.aimPoint(player, world.motes);
  player.aimX = aim.x;
  player.aimY = aim.y;

  player.fireTimer -= dt;
  const fireInterval = PLAYER.fireInterval / (1 + 0.25 * world.blessings.rapid);
  if (player.fireTimer <= 0) {
    player.fireTimer = fireInterval;
    firePlayerShot(world);
    if (audio) audio.playShoot();
  }

  // Spawning: small groups from the queue, never a wall.
  if (world.boss === null || world.wave !== 5) {
    if (world.spawnQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        world.spawnTimer = WAVES[world.wave - 1].spawnInterval;
        const group = world.spawnQueue.length >= 2 && world.random() < 0.35 ? 2 : 1;
        for (let i = 0; i < group && world.spawnQueue.length > 0; i += 1) {
          spawnMote(world, world.spawnQueue.shift());
          world.spawnedCount += 1;
        }
      }
    }
    if (world.wave >= 2 && !world.goldenSpawnedThisWave && world.spawnedCount >= 3) {
      spawnGoldenMote(world);
    }
  }

  // Steer motes; spitters report when they fire. A golden mote that
  // reaches the arena edge has crossed once and despawns.
  for (const mote of world.motes.slice()) {
    const fired = steerMote(mote, dt, player, world.random);
    if (mote.kind === 'golden' && (mote.x < 20 || mote.x > FIELD.width - 20 || mote.y < 20 || mote.y > FIELD.height - 20)) {
      world.motes.splice(world.motes.indexOf(mote), 1);
      continue;
    }
    if (fired === 'orb') {
      const angle = Math.atan2(player.y - mote.y, player.x - mote.x);
      world.orbs.push({
        x: mote.x + Math.cos(angle) * (mote.radius + 8),
        y: mote.y + Math.sin(angle) * (mote.radius + 8),
        vx: Math.cos(angle) * MOTE.spitter.orbSpeed,
        vy: Math.sin(angle) * MOTE.spitter.orbSpeed,
        radius: MOTE.spitter.orbRadius,
      });
    }
  }

  // Boss behaviour on wave 5.
  if (world.boss) {
    const event = steerBoss(world.boss, dt, player, world.random);
    if (event.burst) {
      if (audio) audio.playBossTick();
      world.orbs.push(...bossRadialBurst(world.boss));
    }
    if (event.spawnAdds) {
      for (let i = 0; i < event.spawnAdds; i += 1) spawnMote(world, 'darter');
    }
    if (event.trickle && world.motes.length < BOSS.trickleCap) {
      spawnMote(world, 'darter');
    }
    if (Math.hypot(player.x - world.boss.x, player.y - world.boss.y) < PLAYER.radius + world.boss.radius - 4) {
      hurtPlayer(world, 1, world.boss.x, world.boss.y, audio, particles);
    }
  }

  updateBullets(world, particles, audio, dt);
  if (world.screen !== 'play') return;
  updateOrbs(world, dt, audio, particles);

  // Mote contact damage.
  for (const mote of world.motes.slice()) {
    if (Math.hypot(player.x - mote.x, player.y - mote.y) < PLAYER.radius + mote.radius - 2) {
      hurtPlayer(world, 1, mote.x, mote.y, audio, particles);
      if (world.screen !== 'play') return;
    }
  }

  // Shards drift to the player (magnet range doubles with Star Magnet).
  const magnetRange = 90 * (world.blessings.magnet > 0 ? 2 : 1);
  for (let i = world.shards.length - 1; i >= 0; i -= 1) {
    const shard = world.shards[i];
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < magnetRange) {
      const pull = 520 * dt;
      shard.x += (dx / (distance || 1)) * pull;
      shard.y += (dy / (distance || 1)) * pull;
    }
    if (distance < PLAYER.radius + 8) world.shards.splice(i, 1);
  }

  // Wave clear: queue drained and nothing alive (boss wave: boss dead).
  // A golden mote does NOT block the clear: it is a bonus chase, not
  // part of waveTotal, so a live golden no longer delays the clear by
  // ~6 s while it crosses and despawns. Any golden still alive is
  // culled with the wave so it cannot leak into the next one.
  if (world.wave < 5) {
    const hostilesLeft = world.motes.filter((mote) => mote.kind !== 'golden').length;
    if (world.spawnQueue.length === 0 && world.spawnedCount >= world.waveTotal && hostilesLeft === 0) {
      world.motes = world.motes.filter((mote) => mote.kind !== 'golden');
      world.score += 10 * world.wave;
      world.breatherTimer = MOTE.breatherSeconds;
      world.screen = 'breather';
    }
  }
}

export function updateBreather(world, dt) {
  if (world.screen !== 'breather') return;
  world.time += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  world.breatherTimer -= dt;
  if (world.breatherTimer <= 0) offerDraft(world);
}
