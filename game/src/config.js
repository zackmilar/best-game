// config.js — every tuning number and colour in Starfall Keep.
// One place to tune the game: the play-test lane changes values here
// and nowhere else. All speeds are px/s, all times seconds.

export const FIELD = { width: 1280, height: 720 };

export const PALETTE = {
  backgroundTop: '#0b1030',
  backgroundBottom: '#1a0f3c',
  arenaEdge: '#3a2d6b',
  keepGlow: '#ffb347',
  keepCore: '#ffe9a8',
  player: '#ffd166',
  playerRing: '#fff3c4',
  bullet: '#aef3ff',
  drifter: '#b388ff',
  darter: '#e26bff',
  spitter: '#7ef0c1',
  golden: '#ffd700',
  boss: '#ff5d8f',
  bossCore: '#2b0a1e',
  orb: '#ff8fa3',
  starlight: '#ffe066',
  text: '#f4f1ff',
  textDim: '#b9b3d9',
  danger: '#ff5d5d',
  card: '#241b4d',
  cardEdge: '#6b5bb5',
  cardHover: '#3a2d7a',
};

export const PLAYER = {
  radius: 16,
  speed: 300,
  maxHp: 3,
  hurtInvulnerableSeconds: 1.0,
  knockback: 120,
  fireInterval: 1 / 6,
  bulletSpeed: 620,
  bulletRadius: 4,
  bulletDamage: 1,
  dashDistance: 340,
  dashSeconds: 0.16,
  dashCooldown: 2.5,
  dashInvulnerableSeconds: 0.25,
  dashTrailDamage: 1,
};

export const COMBO = {
  windowSeconds: 3,
  maxMultiplier: 5,
  basePoints: 2,
  goldenPoints: 10,
  bossPoints: 100,
};

export const WAVES = [
  { drifters: 8, darters: 0, spitters: 0, spawnInterval: 1.4 },
  { drifters: 6, darters: 4, spitters: 0, spawnInterval: 1.1 },
  { drifters: 6, darters: 4, spitters: 3, spawnInterval: 0.9 },
  { drifters: 7, darters: 5, spitters: 4, spawnInterval: 0.7 },
  { drifters: 0, darters: 0, spitters: 0, spawnInterval: 4.0 },
];

export const MOTE = {
  drifter: { radius: 14, hp: 1, speedMin: 90, speedMax: 120 },
  darter: { radius: 12, hp: 1, speed: 70, telegraphSeconds: 0.4, lungeSpeed: 420, lungeSeconds: 0.35, lungeCooldown: 1.6 },
  spitter: { radius: 15, hp: 2, speed: 60, keepMin: 260, keepMax: 340, orbSpeed: 160, orbRadius: 6, fireInterval: 2.2 },
  golden: { radius: 12, hp: 1, speed: 200 },
  maxAlive: 14,
  minSpawnDistanceFromPlayer: 180,
  breatherSeconds: 6,
};

export const BOSS = {
  radius: 54,
  hp: 60,
  // +10 HP per blessing the player drafted: a strong build still has
  // to work for the kill, and the boss never becomes a formality.
  hpPerDraft: 10,
  orbitSpeed: 55,
  orbitRadius: 220,
  burstOrbs: 10,
  burstInterval: 3.0,
  addSpawnHpFractions: [0.66, 0.33],
  addsPerSpawn: 3,
  trickleInterval: 4.0,
  trickleCap: 4,
};

export const STARS = { one: 300, two: 450, three: 600 };

export const BLESSINGS = [
  { id: 'spread', name: 'Spread Shot', text: '+1 projectile, fanned out by 10 degrees.', detail: 'More bolts per volley.' },
  { id: 'boots', name: 'Swift Boots', text: '+15% move speed.', detail: 'Outrun the lunge.' },
  { id: 'magnet', name: 'Star Magnet', text: 'Starlight flies to you from twice as far. Combo window +1 s.', detail: 'Greed, rewarded.' },
  { id: 'ward', name: 'Lantern Ward', text: '+1 max HP and heal 1 HP now.', detail: 'A second wind.' },
  { id: 'rapid', name: 'Rapid Sigil', text: '+25% fire rate.', detail: 'The lantern sings faster.' },
  { id: 'echo', name: 'Dash Echo', text: 'Dash cooldown -40%, dash trail damage 2.', detail: 'Leave light behind you.' },
];
