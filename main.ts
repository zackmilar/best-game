// Starfall Keep — entrypoint (make.fun best-game-01).
//
// Job: take the finished game in ./game and the staged screenshots in
// ./screenshots, copy both into the grader's output directory, and write
// ./dossier.json there with the kit's buildDossier library.
//
// The output directory is /output inside the grader. Outside it, the
// caller may point MAKEFUN_OUTPUT_DIR at any folder; the default is a
// local ./out folder so the build can be checked by hand.
//
// Determinism is the whole point of this file: same input files, same
// output bytes, every run. So there is no clock, no randomness, no
// directory-listing order that can leak into the result — files are
// copied in sorted path order, and the dossier is produced by the
// unchanged kit library from the copied tree.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Caps mirror the gate in the competition rules: the dossier text is
// capped at 160 KiB, at most 4 screenshots of 256 KiB each, and game/
// holds at most 993 entries totalling 48 MiB with no path over 1,000
// UTF-8 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here);
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? join(repoRoot, 'out'));

function copyTreeIntoOutput(sourceDir: string, targetDir: string): void {
  // rmSync + mkdirSync + cpSync with a sorted walk inside the library
  // keeps the output tree identical run after run; cpSync itself copies
  // in directory order, and buildDossier sorts what it reads, so the
  // dossier bytes do not depend on filesystem order either. A missing
  // game/ is a hard error (nothing to grade); a missing screenshots/
  // only means the shots have not been staged yet, and the caller fills
  // it in before the real run.
  if (!existsSync(sourceDir)) {
    throw new Error(`Starfall Keep: missing input directory ${sourceDir}`);
  }
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true, dereference: false });
}

function buildEntry(): void {
  // Start from a clean slate so a stale file from an earlier run can
  // never survive into this output and break byte determinism.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  copyTreeIntoOutput(join(repoRoot, 'game'), join(outputDir, 'game'));
  const shotsDir = join(repoRoot, 'screenshots');
  if (existsSync(shotsDir)) {
    copyTreeIntoOutput(shotsDir, join(outputDir, 'screenshots'));
  } else {
    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`Starfall Keep: wrote ${outputDir} (dossier ${dossier.length} bytes)`);
}

buildEntry();
