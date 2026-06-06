import assert from 'node:assert/strict';
import {
  ACQUISITION_STATUSES,
  PLAY_STATUSES,
  PRIMARY_PLAY_STATUSES,
  emptyGameForm,
  fromDatabaseRow,
  normalizeGame,
  normalizeImportedGame,
  toDatabaseRow,
  toGameForm,
} from './gameModel.js';

const fixedNow = '2026-06-05T12:00:00.000Z';
const uuid = () => '00000000-0000-4000-8000-000000000001';

assert.deepEqual(PLAY_STATUSES.map((status) => status.id), ['need_to_play', 'playing', 'completed', 'dropped']);
assert.deepEqual(PLAY_STATUSES.map((status) => status.label), ['Need to play', 'Playing', 'Completed', 'Dropped']);
assert.deepEqual(PRIMARY_PLAY_STATUSES.map((status) => status.id), ['need_to_play', 'playing', 'completed']);
assert.deepEqual(ACQUISITION_STATUSES.map((status) => status.id), [
  'unknown',
  'owned',
  'needs_acquiring',
  'not_applicable',
]);
assert.equal(emptyGameForm.play_status, 'need_to_play');
assert.equal(emptyGameForm.acquisition_status, 'unknown');

const legacyImported = normalizeImportedGame(
  {
    id: 'legacy-1',
    title: 'Legacy played game',
    platform: 'Switch',
    status: 'played',
    priority: 'High',
    tags: ['zelda'],
    acquired_at: '2026-01-01T00:00:00.000Z',
    source_notes: 'Cart on shelf',
    rom_path: '/roms/switch/zelda.xci',
    library_match_id: 'igdb:123',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  { now: () => fixedNow, uuid },
);
assert.equal(legacyImported.play_status, 'completed');
assert.equal(legacyImported.status, 'completed');
assert.equal(legacyImported.acquisition_status, 'owned');
assert.equal(legacyImported.acquired_at, '2026-01-01T00:00:00.000Z');
assert.equal(legacyImported.source_notes, 'Cart on shelf');
assert.equal(legacyImported.rom_path, '/roms/switch/zelda.xci');
assert.equal(legacyImported.library_match_id, 'igdb:123');
assert.equal(legacyImported.updatedAt, fixedNow);

const legacyInterested = normalizeImportedGame({ title: 'Need to buy', status: 'interested' }, { now: () => fixedNow, uuid });
assert.equal(legacyInterested.play_status, 'need_to_play');
assert.equal(legacyInterested.status, 'need_to_play');
assert.equal(legacyInterested.acquisition_status, 'unknown');

const canonicalCompleted = normalizeImportedGame({ title: 'Canonical status', status: 'completed' }, { now: () => fixedNow, uuid });
assert.equal(canonicalCompleted.play_status, 'completed');
assert.equal(canonicalCompleted.status, 'completed');

const formGame = normalizeGame(
  {
    ...emptyGameForm,
    title: '  Chrono Trigger  ',
    platform: '  SNES  ',
    play_status: 'playing',
    acquisition_status: 'owned',
    tags: ' jrpg, classic ',
    source_notes: '  SNES Classic  ',
    rom_path: '  /roms/snes/chrono.sfc  ',
    library_match_id: '  moby:42  ',
  },
  {},
  { now: () => fixedNow, uuid },
);
assert.equal(formGame.id, uuid());
assert.equal(formGame.title, 'Chrono Trigger');
assert.equal(formGame.play_status, 'playing');
assert.equal(formGame.status, 'playing');
assert.equal(formGame.acquisition_status, 'owned');
assert.deepEqual(formGame.tags, ['jrpg', 'classic']);
assert.equal(formGame.source_notes, 'SNES Classic');
assert.equal(formGame.rom_path, '/roms/snes/chrono.sfc');
assert.equal(formGame.library_match_id, 'moby:42');

const row = toDatabaseRow(formGame, 'user-1');
assert.equal(row.play_status, 'playing');
assert.equal(row.acquisition_status, 'owned');
assert.equal(row.source_notes, 'SNES Classic');
assert.equal(row.rom_path, '/roms/snes/chrono.sfc');
assert.equal(row.library_match_id, 'moby:42');
assert.equal(row.status, 'playing');

const fromRow = fromDatabaseRow({
  ...row,
  cover_url: null,
  updated_at: fixedNow,
});
assert.equal(fromRow.play_status, 'playing');
assert.equal(fromRow.acquisition_status, 'owned');
assert.equal(fromRow.status, 'playing');
assert.equal(fromRow.source_notes, 'SNES Classic');

const legacyRow = fromDatabaseRow({
  id: 'legacy-row',
  title: 'Old row',
  status: 'dropped',
  priority: 'Low',
  tags: null,
});
assert.equal(legacyRow.play_status, 'dropped');
assert.equal(legacyRow.status, 'dropped');
assert.equal(legacyRow.acquisition_status, 'unknown');

const form = toGameForm(formGame);
assert.equal(form.play_status, 'playing');
assert.equal(form.acquisition_status, 'owned');
assert.equal(form.tags, 'jrpg, classic');
assert.equal(form.source_notes, 'SNES Classic');

const clearedOptionalFields = normalizeGame(
  {
    ...toGameForm(formGame),
    acquired_at: '',
    source_notes: '',
    rom_path: '',
    library_match_id: '',
  },
  formGame,
  { now: () => fixedNow, uuid },
);
assert.equal(clearedOptionalFields.acquired_at, '');
assert.equal(clearedOptionalFields.source_notes, '');
assert.equal(clearedOptionalFields.rom_path, '');
assert.equal(clearedOptionalFields.library_match_id, '');

console.log('gameModel tests passed');
