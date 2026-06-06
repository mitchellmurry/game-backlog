export const PLAY_STATUSES = [
  { id: 'need_to_play', label: 'Need to play', hint: 'Games waiting for a first session' },
  { id: 'playing', label: 'Playing', hint: 'Currently in progress' },
  { id: 'completed', label: 'Completed', hint: 'Finished or archived' },
  { id: 'dropped', label: 'Dropped', hint: 'Paused indefinitely' },
];

export const PRIMARY_PLAY_STATUSES = PLAY_STATUSES.filter((status) => status.id !== 'dropped');

export const ACQUISITION_STATUSES = [
  { id: 'unknown', label: 'Unknown' },
  { id: 'owned', label: 'Owned' },
  { id: 'needs_acquiring', label: 'Needs acquiring' },
  { id: 'not_applicable', label: 'Not applicable' },
];

export const PLAY_STATUS_IDS = PLAY_STATUSES.map((status) => status.id);
export const ACQUISITION_STATUS_IDS = ACQUISITION_STATUSES.map((status) => status.id);

const LEGACY_PLAY_STATUS_MAP = {
  interested: 'need_to_play',
  played: 'completed',
};

export const emptyGameForm = {
  title: '',
  platform: '',
  play_status: 'need_to_play',
  acquisition_status: 'unknown',
  priority: 'Medium',
  rating: '',
  tags: '',
  coverUrl: '',
  notes: '',
  acquired_at: '',
  source_notes: '',
  rom_path: '',
  library_match_id: '',
};

function normalizePlayStatus(value) {
  const canonical = LEGACY_PLAY_STATUS_MAP[value] || value;
  return PLAY_STATUS_IDS.includes(canonical) ? canonical : 'need_to_play';
}

function normalizeAcquisitionStatus(value, game = {}) {
  if (ACQUISITION_STATUS_IDS.includes(value)) return value;
  if (game.acquired_at || game.acquiredAt || game.rom_path || game.romPath) return 'owned';
  return 'unknown';
}

function optionalString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function optionalDateString(value) {
  return typeof value === 'string' ? value : '';
}

function valueFromFormOrExisting(form, existing, snakeKey, camelKey = snakeKey) {
  if (Object.hasOwn(form, snakeKey)) return form[snakeKey];
  if (Object.hasOwn(form, camelKey)) return form[camelKey];
  if (Object.hasOwn(existing, snakeKey)) return existing[snakeKey];
  return existing[camelKey];
}

export function normalizeGame(form, existing = {}, dependencies = {}) {
  const now = dependencies.now ? dependencies.now() : new Date().toISOString();
  const uuid = dependencies.uuid || (() => crypto.randomUUID());
  const play_status = normalizePlayStatus(form.play_status || form.status || existing.play_status || existing.status);
  const acquisition_status = normalizeAcquisitionStatus(
    form.acquisition_status || existing.acquisition_status || existing.acquisitionStatus,
    { ...existing, ...form },
  );

  return {
    ...existing,
    id: existing.id || uuid(),
    title: form.title.trim(),
    platform: form.platform.trim(),
    play_status,
    status: play_status,
    acquisition_status,
    priority: form.priority,
    rating: form.rating,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    coverUrl: form.coverUrl.trim(),
    notes: form.notes.trim(),
    acquired_at: optionalDateString(valueFromFormOrExisting(form, existing, 'acquired_at', 'acquiredAt')),
    source_notes: optionalString(valueFromFormOrExisting(form, existing, 'source_notes', 'sourceNotes')),
    rom_path: optionalString(valueFromFormOrExisting(form, existing, 'rom_path', 'romPath')),
    library_match_id: optionalString(valueFromFormOrExisting(form, existing, 'library_match_id', 'libraryMatchId')),
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
}

export function normalizeImportedGame(game, dependencies = {}) {
  const now = dependencies.now ? dependencies.now() : new Date().toISOString();
  const uuid = dependencies.uuid || (() => crypto.randomUUID());
  const play_status = normalizePlayStatus(game.play_status || game.playStatus || game.status);
  const acquisition_status = normalizeAcquisitionStatus(game.acquisition_status || game.acquisitionStatus, game);

  return {
    id: game.id || uuid(),
    title: game.title || 'Untitled game',
    platform: game.platform || '',
    play_status,
    status: play_status,
    acquisition_status,
    priority: game.priority || 'Medium',
    rating: game.rating || '',
    tags: Array.isArray(game.tags) ? game.tags : [],
    coverUrl: game.coverUrl || game.cover_url || '',
    notes: game.notes || '',
    acquired_at: optionalDateString(game.acquired_at || game.acquiredAt),
    source_notes: optionalString(game.source_notes || game.sourceNotes),
    rom_path: optionalString(game.rom_path || game.romPath),
    library_match_id: optionalString(game.library_match_id || game.libraryMatchId),
    createdAt: game.createdAt || game.created_at || now,
    updatedAt: now,
  };
}

export function toGameForm(game) {
  return {
    title: game.title || '',
    platform: game.platform || '',
    play_status: normalizePlayStatus(game.play_status || game.status),
    acquisition_status: normalizeAcquisitionStatus(game.acquisition_status || game.acquisitionStatus, game),
    priority: game.priority || 'Medium',
    rating: game.rating || '',
    tags: Array.isArray(game.tags) ? game.tags.join(', ') : '',
    coverUrl: game.coverUrl || '',
    notes: game.notes || '',
    acquired_at: game.acquired_at || '',
    source_notes: game.source_notes || '',
    rom_path: game.rom_path || '',
    library_match_id: game.library_match_id || '',
  };
}

export function fromDatabaseRow(row) {
  const play_status = normalizePlayStatus(row.play_status || row.status);
  const acquisition_status = normalizeAcquisitionStatus(row.acquisition_status, row);

  return {
    id: row.id,
    title: row.title,
    platform: row.platform || '',
    play_status,
    status: play_status,
    acquisition_status,
    priority: row.priority,
    rating: row.rating || '',
    tags: row.tags || [],
    coverUrl: row.cover_url || '',
    notes: row.notes || '',
    acquired_at: row.acquired_at || '',
    source_notes: row.source_notes || '',
    rom_path: row.rom_path || '',
    library_match_id: row.library_match_id || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDatabaseRow(game, userId) {
  const play_status = normalizePlayStatus(game.play_status || game.status);
  const acquisition_status = normalizeAcquisitionStatus(game.acquisition_status || game.acquisitionStatus, game);

  return {
    id: game.id,
    user_id: userId,
    title: game.title,
    platform: game.platform || null,
    play_status,
    acquisition_status,
    status: play_status,
    priority: game.priority,
    rating: game.rating || null,
    tags: game.tags || [],
    cover_url: game.coverUrl || null,
    notes: game.notes || null,
    acquired_at: game.acquired_at || null,
    source_notes: game.source_notes || null,
    rom_path: game.rom_path || null,
    library_match_id: game.library_match_id || null,
    created_at: game.createdAt,
    updated_at: game.updatedAt,
  };
}
