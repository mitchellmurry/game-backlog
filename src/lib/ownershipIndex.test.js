import assert from 'node:assert/strict';
import { applyOwnershipIndexToGames, normalizeRomTitle, resolveOwnershipState, toOwnedIndex } from './ownershipIndex.js';

const ownershipIndex = toOwnedIndex({
  generated_at: '2026-06-05T12:00:00.000Z',
  source_root: '/mnt/user/data/media/games',
  games: [
    {
      title: 'Chrono Trigger',
      platform: 'SNES',
      path: '/mnt/user/data/media/games/snes/Chrono Trigger (USA).sfc',
      match_id: 'moby:42',
      confidence: 0.96,
    },
    {
      title: 'The Legend of Zelda: Tears of the Kingdom',
      system: 'Switch',
      rom_path: '/mnt/user/data/media/games/switch/Zelda TotK.xci',
    },
  ],
});

const directMatch = resolveOwnershipState(
  { title: 'Chrono Trigger', platform: 'SNES', library_match_id: 'moby:42' },
  ownershipIndex,
);
assert.equal(directMatch.status, 'owned');
assert.equal(directMatch.label, 'Owned');
assert.equal(directMatch.source, 'Nexus library match');
assert.equal(directMatch.rom_path, '/mnt/user/data/media/games/snes/Chrono Trigger (USA).sfc');
assert.equal(directMatch.confidence, 0.96);

const titlePlatformMatch = resolveOwnershipState(
  { title: 'the legend of zelda tears of the kingdom', platform: 'Nintendo Switch' },
  ownershipIndex,
);
assert.equal(titlePlatformMatch.status, 'owned');
assert.equal(titlePlatformMatch.rom_path, '/mnt/user/data/media/games/switch/Zelda TotK.xci');

const missingWhenIndexLoaded = resolveOwnershipState({ title: 'EarthBound', platform: 'SNES' }, ownershipIndex);
assert.equal(missingWhenIndexLoaded.status, 'needs_acquiring');
assert.equal(missingWhenIndexLoaded.label, 'Needs acquiring');
assert.equal(missingWhenIndexLoaded.source, 'Nexus library match');

const unknownWithoutIndex = resolveOwnershipState({ title: 'EarthBound', platform: 'SNES' }, toOwnedIndex(null));
assert.equal(unknownWithoutIndex.status, 'unknown');
assert.equal(unknownWithoutIndex.label, 'Unknown');
assert.equal(unknownWithoutIndex.source, 'No ownership index loaded');

const romNamingCases = [
  ['Chrono Trigger (USA) (Rev 1).sfc', 'chrono trigger'],
  ['Final Fantasy VI (Japan) (T-En by RPGOne v1.2).sfc', 'final fantasy vi'],
  ['Super Mario World (Kaizo Hack v2.0).smc', 'super mario world kaizo hack'],
  ['Metal Gear Solid (Disc 2).chd', 'metal gear solid'],
  ['Resident Evil 2 (USA) (Disc 1) (Leon).cue', 'resident evil 2 leon'],
  ['Street Fighter III 3rd Strike - Fight for the Future (Japan 990608, NO CD).zip', 'street fighter iii 3rd strike fight for future'],
  ['sfiii3n.zip', 'sfiii3n'],
  ['The Legend of Zelda, The - Ocarina of Time (USA).z64', 'legend zelda ocarina time'],
];
for (const [input, expected] of romNamingCases) {
  assert.equal(normalizeRomTitle(input), expected, input);
}

assert.notEqual(
  normalizeRomTitle('Sonic the Hedgehog 2 (Beta).md'),
  normalizeRomTitle('Sonic the Hedgehog 2.md'),
  'prototype/beta tags should remain as conservative matching signal',
);

const variedNameIndex = toOwnedIndex({
  files: [
    { filename: 'Final Fantasy VI (Japan) (T-En by RPGOne v1.2).sfc', systemFolder: 'snes', relativePath: 'snes/Final Fantasy VI (Japan) (T-En by RPGOne v1.2).sfc' },
    { filename: 'Metal Gear Solid (Disc 2).chd', systemFolder: 'psx', relativePath: 'psx/Metal Gear Solid (Disc 2).chd' },
  ],
});
assert.equal(resolveOwnershipState({ title: 'Final Fantasy VI', platform: 'SNES' }, variedNameIndex).status, 'owned');
assert.equal(resolveOwnershipState({ title: 'Metal Gear Solid', platform: 'PS1' }, variedNameIndex).status, 'owned');

const normalizedRomIndex = toOwnedIndex({
  schemaVersion: 1,
  files: [
    {
      id: 'rom:snes:chrono-trigger',
      systemFolder: 'snes',
      filename: 'Chrono Trigger (USA).sfc',
      extension: '.sfc',
      sizeBytes: 123,
      modifiedAt: '2026-06-05T12:00:00.000Z',
      absolutePath: '/mnt/user/data/games/snes/Chrono Trigger (USA).sfc',
      relativePath: 'snes/Chrono Trigger (USA).sfc',
      normalizedTitle: 'chrono trigger',
      normalizedTitleTokens: ['chrono', 'trigger'],
    },
    {
      id: 'rom:gba:chrono-trigger',
      systemFolder: 'gba',
      filename: 'Chrono Trigger.zip',
      extension: '.zip',
      sizeBytes: 456,
      modifiedAt: '2026-06-05T12:00:00.000Z',
      absolutePath: '/mnt/user/data/games/gba/Chrono Trigger.zip',
      relativePath: 'gba/Chrono Trigger.zip',
      normalizedTitle: 'chrono trigger',
      normalizedTitleTokens: ['chrono', 'trigger'],
    },
    {
      id: 'rom:snes:earthbound-a',
      systemFolder: 'snes',
      filename: 'EarthBound (USA).sfc',
      extension: '.sfc',
      sizeBytes: 789,
      modifiedAt: '2026-06-05T12:00:00.000Z',
      absolutePath: '/mnt/user/data/games/snes/EarthBound (USA).sfc',
      relativePath: 'snes/EarthBound (USA).sfc',
      normalizedTitle: 'earthbound',
      normalizedTitleTokens: ['earthbound'],
    },
    {
      id: 'rom:snes:earthbound-b',
      systemFolder: 'snes',
      filename: 'EarthBound (Rev 1).sfc',
      extension: '.sfc',
      sizeBytes: 790,
      modifiedAt: '2026-06-05T12:00:00.000Z',
      absolutePath: '/mnt/user/data/games/snes/EarthBound (Rev 1).sfc',
      relativePath: 'snes/EarthBound (Rev 1).sfc',
      normalizedTitle: 'earthbound',
      normalizedTitleTokens: ['earthbound'],
    },
  ],
});

const exactSameSystemMatch = resolveOwnershipState({ title: 'Chrono Trigger', platform: 'SNES' }, normalizedRomIndex);
assert.equal(exactSameSystemMatch.status, 'owned');
assert.equal(exactSameSystemMatch.match_status, 'matched');
assert.equal(exactSameSystemMatch.rom_path, '/mnt/user/data/games/snes/Chrono Trigger (USA).sfc');
assert.equal(exactSameSystemMatch.library_match_id, 'rom:snes:chrono-trigger');

const ambiguousSameSystemMatch = resolveOwnershipState({ title: 'EarthBound', platform: 'SNES' }, normalizedRomIndex);
assert.equal(ambiguousSameSystemMatch.status, 'unknown');
assert.equal(ambiguousSameSystemMatch.match_status, 'ambiguous');
assert.equal(ambiguousSameSystemMatch.candidates.length, 2);
assert.equal(ambiguousSameSystemMatch.candidates[0].id, 'rom:snes:earthbound-a');
assert.equal(ambiguousSameSystemMatch.candidates[1].id, 'rom:snes:earthbound-b');

const differentSystemOnlyMatch = resolveOwnershipState({ title: 'Chrono Trigger', platform: 'PS1' }, normalizedRomIndex);
assert.equal(differentSystemOnlyMatch.status, 'unknown');
assert.equal(differentSystemOnlyMatch.match_status, 'ambiguous');
assert.equal(differentSystemOnlyMatch.candidates.length, 2);

const appliedIndex = applyOwnershipIndexToGames(
  [
    { id: 'g1', title: 'Chrono Trigger', platform: 'SNES', acquisition_status: 'unknown' },
    { id: 'g2', title: 'EarthBound', platform: 'SNES', acquisition_status: 'unknown' },
  ],
  normalizedRomIndex,
);
assert.equal(appliedIndex.games[0].acquisition_status, 'owned');
assert.equal(appliedIndex.games[0].rom_path, '/mnt/user/data/games/snes/Chrono Trigger (USA).sfc');
assert.equal(appliedIndex.games[1].acquisition_status, 'unknown');
assert.equal(appliedIndex.report.matched.length, 1);
assert.equal(appliedIndex.report.ambiguous.length, 1);
assert.equal(appliedIndex.report.ambiguous[0].game.id, 'g2');

console.log('ownershipIndex tests passed');
