// render.js — everything the player sees: the lantern-keep arena,
// the player orb, motes, boss, bullets, HUD, banners, draft cards, and
// the title / pause / game-over / victory screens. Reads world state,
// draws it, mutates nothing in the simulation.

import { BLESSINGS, FIELD, PALETTE, PLAYER } from './config.js';
import { moteColour } from './enemies.js';
import { drawParticles, shakeOffset } from './particles.js';
import { comboWindow, dashCooldownSeconds } from './world.js';

function drawBackground(context, world) {
  const gradient = context.createRadialGradient(640, 360, 60, 640, 360, 760);
  gradient.addColorStop(0, '#2a1d5e');
  gradient.addColorStop(0.55, PALETTE.backgroundTop);
  gradient.addColorStop(1, PALETTE.backgroundBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
  // Stars: fixed positions from a tiny hash so the sky never flickers.
  context.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 137.5) % 1280);
    const y = ((i * 89.3) % 720);
    const twinkle = 0.25 + 0.35 * Math.abs(Math.sin(world.time * 0.7 + i));
    context.globalAlpha = twinkle;
    context.fillRect(x, y, 2, 2);
  }
  context.globalAlpha = 1;
  // Arena edge.
  context.strokeStyle = PALETTE.arenaEdge;
  context.lineWidth = 3;
  context.strokeRect(14, 14, FIELD.width - 28, FIELD.height - 28);
}

function drawKeep(context, world) {
  const pulse = 1 + 0.06 * Math.sin(world.time * 2);
  const glow = context.createRadialGradient(640, 360, 8, 640, 360, 150 * pulse);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.55)');
  glow.addColorStop(0.5, 'rgba(255, 179, 71, 0.14)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  context.fillStyle = glow;
  context.fillRect(640 - 160, 360 - 160, 320, 320);
  // The keep itself: a small lantern tower at the centre.
  context.fillStyle = '#3a2a12';
  context.fillRect(628, 330, 24, 60);
  context.fillStyle = PALETTE.keepCore;
  context.beginPath();
  context.arc(640, 322, 14 * pulse, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = PALETTE.keepGlow;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(640, 322, 20 * pulse, 0, Math.PI * 2);
  context.stroke();
}

function drawPlayer(context, world) {
  const player = world.player;
  if (player.invulnerable > 0 && Math.floor(world.time * 12) % 2 === 0 && world.screen === 'play') {
    context.globalAlpha = 0.45;
  }
  // Dash trail.
  if (player.dashTrail.length > 1) {
    context.strokeStyle = 'rgba(255, 209, 102, 0.5)';
    context.lineWidth = 10;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(player.dashTrail[0].x, player.dashTrail[0].y);
    for (const point of player.dashTrail) context.lineTo(point.x, point.y);
    context.stroke();
  }
  const glow = context.createRadialGradient(player.x, player.y, 2, player.x, player.y, 44);
  glow.addColorStop(0, 'rgba(255, 209, 102, 0.8)');
  glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
  context.fillStyle = glow;
  context.fillRect(player.x - 48, player.y - 48, 96, 96);
  context.fillStyle = PALETTE.player;
  context.beginPath();
  context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = PALETTE.playerRing;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(player.x, player.y, PLAYER.radius + 3, 0, Math.PI * 2);
  context.stroke();
  // Aim tick.
  const aimAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  context.strokeStyle = PALETTE.bullet;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(player.x + Math.cos(aimAngle) * 22, player.y + Math.sin(aimAngle) * 22);
  context.lineTo(player.x + Math.cos(aimAngle) * 32, player.y + Math.sin(aimAngle) * 32);
  context.stroke();
  // Dash cooldown ring.
  if (player.dashCooldown > 0) {
    const fraction = 1 - player.dashCooldown / dashCooldownSeconds(world);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius + 8, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawMote(context, mote, world) {
  const colour = moteColour(mote.kind);
  const pulse = 1 + 0.12 * Math.sin(mote.pulse);
  if (mote.kind === 'darter' && mote.state === 'telegraph') {
    // Telegraph line toward the player.
    context.strokeStyle = 'rgba(255,255,255,0.65)';
    context.lineWidth = 2;
    context.setLineDash([8, 8]);
    context.beginPath();
    context.moveTo(mote.x, mote.y);
    context.lineTo(world.player.x, world.player.y);
    context.stroke();
    context.setLineDash([]);
  }
  const glow = context.createRadialGradient(mote.x, mote.y, 2, mote.x, mote.y, mote.radius * 2.4);
  glow.addColorStop(0, colour);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  context.globalAlpha = 0.5;
  context.fillStyle = glow;
  context.fillRect(mote.x - mote.radius * 2.5, mote.y - mote.radius * 2.5, mote.radius * 5, mote.radius * 5);
  context.globalAlpha = 1;
  context.fillStyle = mote.flash > 0 ? '#ffffff' : colour;
  // Star-shaped mote: 5 points, spinning slowly.
  const points = 5;
  const outer = mote.radius * pulse;
  const inner = outer * 0.45;
  const rotation = world.time * 1.2 + mote.wobblePhase;
  context.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points;
    const x = mote.x + Math.cos(angle) * radius;
    const y = mote.y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  if (mote.kind === 'spitter') {
    context.fillStyle = '#0b1030';
    context.beginPath();
    context.arc(mote.x, mote.y, mote.radius * 0.35, 0, Math.PI * 2);
    context.fill();
  }
  if (mote.kind === 'golden') {
    context.strokeStyle = '#fff3c4';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(mote.x, mote.y, mote.radius + 5, 0, Math.PI * 2);
    context.stroke();
  }
  if (mote.maxHp > 1) {
    context.fillStyle = '#0b1030';
    context.fillRect(mote.x - 14, mote.y - mote.radius - 10, 28, 5);
    context.fillStyle = PALETTE.spitter;
    context.fillRect(mote.x - 14, mote.y - mote.radius - 10, 28 * (mote.hp / mote.maxHp), 5);
  }
}

function drawBoss(context, boss, world) {
  const pulse = 1 + 0.05 * Math.sin(world.time * 3);
  const glow = context.createRadialGradient(boss.x, boss.y, 10, boss.x, boss.y, boss.radius * 2.6);
  glow.addColorStop(0, 'rgba(255, 93, 143, 0.6)');
  glow.addColorStop(1, 'rgba(255, 93, 143, 0)');
  context.fillStyle = glow;
  context.fillRect(boss.x - boss.radius * 2.8, boss.y - boss.radius * 2.8, boss.radius * 5.6, boss.radius * 5.6);
  context.fillStyle = boss.flash > 0 ? '#ffffff' : PALETTE.boss;
  context.beginPath();
  const points = 8;
  const rotation = world.time * 0.5;
  for (let i = 0; i < points * 2; i += 1) {
    const radius = (i % 2 === 0 ? boss.radius : boss.radius * 0.55) * pulse;
    const angle = rotation + (i * Math.PI) / points;
    const x = boss.x + Math.cos(angle) * radius;
    const y = boss.y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  context.fillStyle = PALETTE.bossCore;
  context.beginPath();
  context.arc(boss.x, boss.y, boss.radius * 0.34, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ff8fa3';
  context.beginPath();
  context.arc(boss.x, boss.y, boss.radius * 0.16, 0, Math.PI * 2);
  context.fill();
}

function drawBulletsAndOrbs(context, world) {
  context.fillStyle = PALETTE.bullet;
  for (const bullet of world.bullets) {
    context.beginPath();
    context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    context.fill();
  }
  for (const orb of world.orbs) {
    const glow = context.createRadialGradient(orb.x, orb.y, 1, orb.x, orb.y, orb.radius * 2.5);
    glow.addColorStop(0, 'rgba(255, 143, 163, 0.9)');
    glow.addColorStop(1, 'rgba(255, 143, 163, 0)');
    context.fillStyle = glow;
    context.fillRect(orb.x - orb.radius * 3, orb.y - orb.radius * 3, orb.radius * 6, orb.radius * 6);
    context.fillStyle = PALETTE.orb;
    context.beginPath();
    context.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = PALETTE.starlight;
  for (const shard of world.shards) {
    context.fillRect(shard.x - 2, shard.y - 2, 4, 4);
  }
}

function drawHearts(context, world) {
  for (let i = 0; i < world.player.maxHp; i += 1) {
    const x = 1180 + i * 28;
    const y = 34;
    context.fillStyle = i < world.player.hp ? '#ff5d7a' : 'rgba(255,255,255,0.18)';
    context.beginPath();
    context.arc(x - 5, y - 3, 7, 0, Math.PI * 2);
    context.arc(x + 5, y - 3, 7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x - 11, y);
    context.lineTo(x, y + 11);
    context.lineTo(x + 11, y);
    context.closePath();
    context.fill();
  }
}

export function drawComboMeter(context, world) {
  if (world.comboChain < 2) return;
  const barWidth = 180;
  const x = 640 - barWidth / 2;
  const y = 66;
  const fraction = Math.max(0, 1 - (world.time - world.comboTimer) / comboWindow(world));
  context.fillStyle = 'rgba(0,0,0,0.4)';
  context.fillRect(x - 4, y - 4, barWidth + 8, 30);
  context.fillStyle = PALETTE.starlight;
  context.fillRect(x, y, barWidth * fraction, 8);
  context.fillStyle = PALETTE.text;
  context.font = 'bold 20px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(`COMBO x${world.combo}`, 640, y + 26);
}

function drawHud(context, world) {
  context.textAlign = 'left';
  context.fillStyle = PALETTE.text;
  context.font = 'bold 26px system-ui, sans-serif';
  context.fillText(`SCORE ${world.score}`, 28, 40);
  context.font = '18px system-ui, sans-serif';
  context.fillStyle = PALETTE.textDim;
  context.fillText(`BEST ${Math.max(world.best, world.score)}`, 28, 64);
  context.textAlign = 'center';
  context.fillStyle = PALETTE.text;
  context.font = 'bold 24px system-ui, sans-serif';
  context.fillText(world.wave >= 5 ? 'WAVE 5 — HOLLOW STAR' : `WAVE ${world.wave} / 5`, 640, 40);
  drawHearts(context, world);
  drawComboMeter(context, world);
  if (world.boss) {
    const barWidth = 420;
    const x = 640 - barWidth / 2;
    const y = 676;
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(x - 4, y - 4, barWidth + 8, 18);
    context.fillStyle = PALETTE.boss;
    context.fillRect(x, y, barWidth * Math.max(0, world.boss.hp / world.boss.maxHp), 10);
    context.fillStyle = PALETTE.text;
    context.font = 'bold 15px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('HOLLOW STAR', 640, y - 8);
  }
  // Dash readiness, bottom-left.
  context.textAlign = 'left';
  context.font = '16px system-ui, sans-serif';
  context.fillStyle = world.player.dashCooldown <= 0 ? PALETTE.starlight : PALETTE.textDim;
  context.fillText(world.player.dashCooldown <= 0 ? 'DASH READY — SPACE' : 'DASH…', 28, 690);
}

function drawBanner(context, world) {
  if (world.bannerTimer <= 0 || !world.banner) return;
  const alpha = Math.min(1, world.bannerTimer);
  context.globalAlpha = alpha;
  context.fillStyle = PALETTE.text;
  context.font = 'bold 52px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(world.banner, 640, 200);
  context.globalAlpha = 1;
}

function drawHint(context, world) {
  if (world.hintTimer <= 0 || world.screen !== 'play') return;
  context.globalAlpha = Math.min(1, world.hintTimer);
  context.fillStyle = PALETTE.textDim;
  context.font = '18px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('WASD move  ·  mouse aim  ·  SPACE dash  ·  P pause', 640, 640);
  context.globalAlpha = 1;
}

function drawTitle(context, world) {
  context.fillStyle = 'rgba(5, 8, 28, 0.62)';
  context.fillRect(0, 0, FIELD.width, FIELD.height);
  context.textAlign = 'center';
  context.fillStyle = PALETTE.keepGlow;
  context.font = 'bold 84px system-ui, sans-serif';
  context.fillText('STARFALL KEEP', 640, 250);
  context.fillStyle = PALETTE.text;
  context.font = '26px system-ui, sans-serif';
  context.fillText('Blast the void motes. Survive 5 waves.', 640, 310);
  context.fillStyle = PALETTE.textDim;
  context.font = '22px system-ui, sans-serif';
  context.fillText('WASD move  ·  mouse aim  ·  SPACE dash', 640, 348);
  context.fillText('Break the Hollow Star.', 640, 386);
  context.fillStyle = PALETTE.starlight;
  context.font = 'bold 26px system-ui, sans-serif';
  context.fillText('Click or press ENTER to play', 640, 470);
  context.fillStyle = PALETTE.textDim;
  context.font = '18px system-ui, sans-serif';
  context.fillText(`Best score: ${world.best}`, 640, 520);
  context.fillText('M mutes sound  ·  R restarts any time', 640, 552);
}

function drawDraft(context, world) {
  context.fillStyle = 'rgba(5, 8, 28, 0.72)';
  context.fillRect(0, 0, FIELD.width, FIELD.height);
  context.textAlign = 'center';
  context.fillStyle = PALETTE.text;
  context.font = 'bold 44px system-ui, sans-serif';
  context.fillText(`WAVE ${world.wave} CLEAR — CHOOSE A BLESSING`, 640, 130);
  context.font = '20px system-ui, sans-serif';
  context.fillStyle = PALETTE.textDim;
  context.fillText('Pick 1 of 3 — click a card or press 1 / 2 / 3', 640, 168);
  world.draftChoices.forEach((blessing, index) => {
    const cardWidth = 300;
    const cardHeight = 240;
    const x = 640 + (index - 1) * 340 - cardWidth / 2;
    const y = 230;
    const hovered = world.hoverCard === index;
    context.fillStyle = hovered ? PALETTE.cardHover : PALETTE.card;
    context.fillRect(x, y, cardWidth, cardHeight);
    context.strokeStyle = PALETTE.cardEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, cardWidth, cardHeight);
    context.fillStyle = PALETTE.starlight;
    context.font = 'bold 26px system-ui, sans-serif';
    context.fillText(blessing.name, 640 + (index - 1) * 340, y + 56);
    context.fillStyle = PALETTE.text;
    context.font = '19px system-ui, sans-serif';
    wrapText(context, blessing.text, 640 + (index - 1) * 340, y + 104, cardWidth - 36, 26);
    context.fillStyle = PALETTE.textDim;
    context.font = '16px system-ui, sans-serif';
    context.fillText(blessing.detail, 640 + (index - 1) * 340, y + 196);
    context.fillStyle = PALETTE.cardEdge;
    context.font = 'bold 18px system-ui, sans-serif';
    context.fillText(`[${index + 1}]`, 640 + (index - 1) * 340, y + 222);
  });
}

function wrapText(context, text, centreX, startY, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [''];
  for (const word of words) {
    const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (context.measureText(trial).width > maxWidth && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = trial;
  }
  lines.forEach((line, i) => context.fillText(line, centreX, startY + i * lineHeight));
}

function drawEndScreen(context, world) {
  const victory = world.screen === 'victory';
  context.fillStyle = 'rgba(5, 8, 28, 0.72)';
  context.fillRect(0, 0, FIELD.width, FIELD.height);
  context.textAlign = 'center';
  context.fillStyle = victory ? PALETTE.starlight : PALETTE.danger;
  context.font = 'bold 56px system-ui, sans-serif';
  context.fillText(victory ? 'THE HOLLOW STAR BREAKS' : `THE LIGHT FADES — WAVE ${world.endStats ? world.endStats.waves : world.wave}`, 640, 190);
  const stats = world.endStats;
  if (victory && stats) {
    const stars = stats.score >= 600 ? 3 : stats.score >= 450 ? 2 : stats.score >= 300 ? 1 : 0;
    context.font = '64px system-ui, sans-serif';
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < stars ? PALETTE.starlight : 'rgba(255,255,255,0.2)';
      context.fillText('★', 640 + (i - 1) * 80, 270);
    }
  }
  if (stats) {
    context.fillStyle = PALETTE.text;
    context.font = '24px system-ui, sans-serif';
    const rows = [
      `Score ${stats.score}${world.newBest ? ' — NEW BEST!' : ''}`,
      `Best ${stats.best}`,
      `Waves ${stats.waves} / 5`,
      `Motes popped ${stats.motes}`,
      `Accuracy ${stats.accuracy}%`,
      `Time ${formatTime(stats.time)}`,
    ];
    rows.forEach((row, i) => context.fillText(row, 640, 330 + i * 36));
  }
  context.fillStyle = PALETTE.starlight;
  context.font = 'bold 28px system-ui, sans-serif';
  context.fillText(victory ? 'Play again (R)' : 'Try again (R)', 640, 600);
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function drawBreather(context, world) {
  context.textAlign = 'center';
  context.fillStyle = PALETTE.text;
  context.font = 'bold 44px system-ui, sans-serif';
  context.fillText(`WAVE ${world.wave} CLEAR`, 640, 300);
  context.font = '24px system-ui, sans-serif';
  context.fillStyle = PALETTE.textDim;
  context.fillText(`Wave bonus +${10 * world.wave}  ·  next wave in ${Math.max(0, Math.ceil(world.breatherTimer))}…`, 640, 348);
}

export function drawGame(context, world, particles) {
  const offset = shakeOffset(particles);
  context.save();
  context.translate(offset.x, offset.y);
  drawBackground(context, world);
  drawKeep(context, world);
  for (const mote of world.motes) drawMote(context, mote, world);
  if (world.boss) drawBoss(context, world.boss, world);
  drawBulletsAndOrbs(context, world);
  drawPlayer(context, world);
  drawParticles(context, particles);
  context.restore();

  if (world.screen === 'title') {
    drawTitle(context, world);
  } else if (world.screen === 'draft') {
    drawDraft(context, world);
  } else if (world.screen === 'victory' || world.screen === 'gameover') {
    drawEndScreen(context, world);
  } else if (world.screen === 'breather') {
    drawBreather(context, world);
  } else if (world.screen === 'paused') {
    context.fillStyle = 'rgba(5, 8, 28, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = 'bold 48px system-ui, sans-serif';
    context.fillText('PAUSED', 640, 320);
    context.font = '22px system-ui, sans-serif';
    context.fillText('P to resume  ·  R to restart', 640, 370);
  }
  if (world.screen === 'play' || world.screen === 'paused' || world.screen === 'breather') {
    drawHud(context, world);
    drawBanner(context, world);
    drawHint(context, world);
  }
  // Low-HP vignette: the keep is in danger.
  if (world.player.hp === 1 && (world.screen === 'play' || world.screen === 'paused')) {
    const vignette = context.createRadialGradient(640, 360, 260, 640, 360, 620);
    vignette.addColorStop(0, 'rgba(255, 40, 60, 0)');
    vignette.addColorStop(1, 'rgba(255, 40, 60, 0.35)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

export function draftCardAt(world, x, y) {
  if (world.screen !== 'draft') return -1;
  for (let index = 0; index < 3; index += 1) {
    const cardX = 640 + (index - 1) * 340 - 150;
    if (x >= cardX && x <= cardX + 300 && y >= 230 && y <= 470) return index;
  }
  return -1;
}
