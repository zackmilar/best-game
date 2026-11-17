// shots.js — deterministic screenshot staging.
// ?shot=<scene>&seed=<n> plays the real game forward with the seeded
// RNG and a fixed simulated clock, then paints twice and sets
// window.__shotReady so the renderer can capture the frame. The same
// scene + seed gives the same frame every time: no wall clock, no
// Math.random, no audio (shots run silent).
//
// Scenes (see shots.json):
//   play    — mid-wave-3 action, HUD + combo x3 + 8+ motes (cover)
//   title   — title screen over a faint attract-mode arena
//   boss    — wave-5 boss fight, boss HP bar, radial burst, adds
//   victory — victory screen, 3 stars, stats, Play again

import { createWorld, startRun, startWave, updateWorld } from './world.js';

const STEP = 1 / 60;

function makeFakeInput(circle) {
  // The fake pilot aims at the nearest mote and, when circling, walks
  // a slow orbit around the keep so it survives a staged boss fight
  // instead of standing still and dying on camera.
  const input = {
    keys: new Set(),
    circleAngle: 0,
    moveVector: () => {
      if (!circle) return { x: 0, y: 0 };
      input.circleAngle += (Math.PI * 2) / (60 * 6);
      return { x: Math.cos(input.circleAngle), y: Math.sin(input.circleAngle) * 0.7 };
    },
    aimPoint: (player, motes) => {
      if (motes && motes.length > 0) return { x: motes[0].x, y: motes[0].y };
      return { x: player.x, y: player.y - 100 };
    },
    consumeDash: () => false,
    wasPressed: () => false,
    endStep: () => {},
  };
  return input;
}

function silentAudio() {
  return {
    playPop: () => {},
    playGoldenPop: () => {},
    playShoot: () => {},
    playHurt: () => {},
    playDash: () => {},
    playDraft: () => {},
    playWaveHorn: () => {},
    playBossRoar: () => {},
    playBossTick: () => {},
    playVictory: () => {},
    playDefeat: () => {},
  };
}

function silentParticles() {
  return {
    state: { shards: [], texts: [], shakeTime: 0, shakeStrength: 0, hitStopTime: 0, time: 0 },
    helpers: {
      spawnBurst: () => {},
      spawnFloatingText: () => {},
    },
  };
}

// Drive the world forward N fixed steps with the fake input.
export function advanceWorld(world, steps, input, particles, audio) {
  for (let i = 0; i < steps; i += 1) updateWorld(world, STEP, input, particles, audio);
}

export function stageShot(scene, seed, world, particles, audio) {
  const input = makeFakeInput();
  const quietParticles = silentParticles();
  const quietAudio = silentAudio();
  // The seeded RNG lives inside the world (created in main.js from the
  // same seed), so staging advances the exact same simulation as play.

  if (scene === 'title') {
    // Attract mode: a wave-1 arena simmers behind the title card.
    world.screen = 'title';
    startRun(world);
    advanceWorld(world, 60 * 6, input, quietParticles, quietAudio);
    world.screen = 'title';
    world.time = 6;
    return;
  }

  if (scene === 'play') {
    startRun(world);
    advanceWorld(world, 60 * 3, input, quietParticles, quietAudio);
    // Jump to wave 3 with a healthy combo already built.
    startWave(world, 3);
    world.combo = 3;
    world.comboChain = 3;
    world.comboTimer = world.time;
    world.score = 86;
    world.motesPopped = 24;
    advanceWorld(world, 60 * 9, input, quietParticles, quietAudio);
    world.combo = 3;
    world.comboChain = 3;
    world.comboTimer = world.time;
    // The staged pilot stands still and takes hits; restore full HP
    // so the cover shows the fight, not the low-HP vignette, and clear
    // the hurt-invulnerability so the player is not drawn dimmed.
    world.player.hp = world.player.maxHp;
    world.player.invulnerable = 0;
    return;
  }

  if (scene === 'boss') {
    startRun(world);
    world.draftsTaken = 2;
    startWave(world, 5);
    // Circle the arena in 1 s chunks, patching HP between chunks so
    // the pilot survives long enough to photograph the boss fight.
    const circling = makeFakeInput(true);
    for (let chunk = 0; chunk < 8; chunk += 1) {
      advanceWorld(world, 60, circling, quietParticles, quietAudio);
      if (world.screen !== 'play') break;
      world.player.hp = world.player.maxHp;
      world.player.invulnerable = 1.0;
    }
    // Force a fresh radial burst on screen for the shot.
    if (world.boss && world.screen === 'play') {
      world.boss.burstTimer = 0.01;
      advanceWorld(world, 3, circling, quietParticles, quietAudio);
      world.player.hp = world.player.maxHp;
      // Clear the hurt-invulnerability the chunks left behind, so the
      // player is not drawn dimmed (45% alpha blink) in the shot.
      world.player.invulnerable = 0;
      // A boss fight at wave 5 never has a score of 2: stage a
      // plausible mid-run score for the frame.
      world.score = 320;
    }
    return;
  }

  if (scene === 'victory') {
    startRun(world);
    world.score = 612;
    world.motesPopped = 58;
    world.shotsFired = 240;
    world.shotsHit = 168;
    world.runTime = 218;
    world.screen = 'victory';
    world.victory = true;
    world.endStats = {
      score: 612,
      best: 612,
      waves: 5,
      motes: 58,
      accuracy: 70,
      time: 218,
    };
    world.newBest = true;
    world.best = 612;
    return;
  }

  // Unknown scene: fall back to the title.
  world.screen = 'title';
}

export function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    scene: params.get('shot') || null,
    seed: Number.parseInt(params.get('seed') || '7', 10) || 7,
  };
}
