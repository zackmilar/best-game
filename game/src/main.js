// main.js — boot, fixed-step loop, screen state machine.
// One 1/60 s step per update, always: the game plays the same at any
// display refresh rate, and a staged screenshot advances the same steps.

import { FIELD } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createParticles, spawnBurst, spawnFloatingText, updateParticles } from './particles.js';
import { draftCardAt, drawGame } from './render.js';
import { readShotParams, stageShot } from './shots.js';
import { createWorld, draftBlessing, startRun, updateBreather, updateWorld } from './world.js';
import { makeSeededRandom } from './random.js';

const STEP = 1 / 60;
const BEST_KEY = 'starfall-keep.best';

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (error) {
    return 0;
  }
}

function boot() {
  const canvas = document.getElementById('game');
  const context = canvas.getContext('2d');
  const { scene, seed } = readShotParams();
  const random = makeSeededRandom(scene ? seed : (Date.now() % 2147483647));
  const world = createWorld(random);
  world.best = readBest();
  const input = createInput(canvas);
  const audio = createAudio();
  const particles = createParticles();
  const particleApi = {
    state: particles,
    helpers: { spawnBurst, spawnFloatingText },
  };

  if (scene) {
    stageShot(scene, seed, world, particleApi, audio);
    // Paint twice, then signal the renderer the frame is ready.
    drawGame(context, world, particles);
    drawGame(context, world, particles);
    window.__shotReady = true;
    return;
  }

  let lastTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += elapsed;

    // Hit-stop freezes the simulation briefly after a big pop.
    const frozen = particles.hitStopTime > 0;
    while (accumulator >= STEP && !frozen) {
      stepGame();
      accumulator -= STEP;
    }
    if (frozen) accumulator = 0;
    if (world.screen !== 'paused') updateParticles(particles, STEP);
    drawGame(context, world, particles);
  }

  function stepGame() {
    // Global keys, handled whatever the screen is.
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (input.wasPressed('KeyR')) {
      audio.ensure();
      startRun(world, audio);
      input.endStep();
      return;
    }

    if (world.screen === 'title') {
      if (input.wasPressed('Enter') || input.consumeClick()) {
        audio.ensure();
        audio.startMusic();
        startRun(world, audio);
      }
      input.endStep();
      return;
    }

    if (world.screen === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) world.screen = 'play';
      // A click during pause is not an input: discard it so it can
      // never leak into a later end screen (stale-click fix).
      input.consumeClick();
      input.endStep();
      return;
    }

    if (world.screen === 'draft') {
      const click = input.consumeClick();
      world.hoverCard = draftCardAt(world, input.mouseX, input.mouseY);
      // Guard the card row: a pick on an emptied row must be a no-op,
      // never a throw (the draft branch re-runs every step).
      if (input.wasPressed('Digit1') && world.draftChoices[0]) draftBlessing(world, world.draftChoices[0].id, audio);
      else if (input.wasPressed('Digit2') && world.draftChoices[1]) draftBlessing(world, world.draftChoices[1].id, audio);
      else if (input.wasPressed('Digit3') && world.draftChoices[2]) draftBlessing(world, world.draftChoices[2].id, audio);
      else if (click) {
        const card = draftCardAt(world, click.x, click.y);
        if (card >= 0 && world.draftChoices[card]) draftBlessing(world, world.draftChoices[card].id, audio);
      }
      input.endStep();
      return;
    }

    if (world.screen === 'victory' || world.screen === 'gameover') {
      if (input.wasPressed('Enter') || input.consumeClick()) startRun(world, audio);
      input.endStep();
      return;
    }

    if (world.screen === 'breather') {
      updateBreather(world, STEP);
      // Same stale-click discard as pause: a breather click must not
      // survive into the draft pick that follows it.
      input.consumeClick();
      input.endStep();
      return;
    }

    if (world.screen === 'play') {
      // A left click does nothing in play (aim is mousemove, dash is
      // Space/right-click), so consume and discard it here: a click
      // made during play must never persist into the next end screen
      // and auto-restart / auto-pick it (stale-click fix).
      input.consumeClick();
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        world.screen = 'paused';
        input.endStep();
        return;
      }
      if (input.wasPressed('Space')) {
        // Space is the dash (see input.js); a manual shot toward the
        // aim point is a harmless redundancy for keyboard-only play.
        const player = world.player;
        world.bullets.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(Math.atan2(player.aimY - player.y, player.aimX - player.x)) * 620,
          vy: Math.sin(Math.atan2(player.aimY - player.y, player.aimX - player.x)) * 620,
          radius: 4,
          damage: 1,
        });
      }
      updateWorld(world, STEP, input, particleApi, audio);
      input.endStep();
      return;
    }

    input.endStep();
  }

  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
