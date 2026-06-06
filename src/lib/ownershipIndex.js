const STATUS_LABELS = {
  owned: 'Owned',
  needs_acquiring: 'Needs acquiring',
  unknown: 'Unknown',
  not_applicable: 'Not applicable',
};

const PLATFORM_ALIASES = new Map([
  ['nintendo switch', 'switch'],
  ['switch', 'switch'],
  ['super nintendo', 'snes'],
  ['super nintendo entertainment system', 'snes'],
  ['snes', 'snes'],
  ['gba', 'gba'],
  ['game boy advance', 'gba'],
  ['ps1', 'playstation'],
  ['psx', 'playstation'],
  ['psone', 'playstation'],
  ['playstation 1', 'playstation'],
  ['sony playstation', 'playstation'],
]);

const ROM_EXTENSIONS = new Set([
  '7z',
  'bin',
  'chd',
  'cue',
  'gb',
  'gba',
  'gbc',
  'iso',
  'md',
  'nes',
  'nsp',
  'sfc',
  'smc',
  'xci',
  'z64',
  'zip',
]);

const DROP_GROUP_PATTERNS = [
  /^(usa|europe|japan|world|asia|korea|france|germany|italy|spain|australia|brazil|canada|china|taiwan|hong kong|netherlands|sweden|russia|uk|united kingdom)(\s|$)/i,
  /^rev\s*[a-z0-9.]*$/i,
  /^revision\s*[a-z0-9.]*$/i,
  /^v\d+(?:\.\d+)*$/i,
  /^version\s*\d+(?:\.\d+)*$/i,
  /^disc\s*\d+$/i,
  /^disk\s*\d+$/i,
  /^side\s*[ab0-9]$/i,
  /^t[- ]?en\b/i,
  /^translation\b/i,
  /^translated\b/i,
  /^no\s*cd$/i,
  /^multi\s*\d+$/i,
  /^[a-z]+\s*\d{6}(?:\s*,?\s*no\s*cd)?$/i,
];

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripKnownExtension(value) {
  return String(value || '').replace(/\.([a-z0-9]{2,4})$/i, (match, ext) => (ROM_EXTENSIONS.has(ext.toLowerCase()) ? '' : match));
}

function shouldDropBracketGroup(group) {
  const normalized = normalizeToken(group);
  if (!normalized) return true;
  return DROP_GROUP_PATTERNS.some((pattern) => pattern.test(normalized));
}

function cleanBracketGroup(group) {
  return normalizeToken(group)
    .replace(/\bv\d+(?:\s+\d+)*\b/g, ' ')
    .replace(/\bversion\s*\d+(?:\s+\d+)*\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripRomMetadataGroups(value) {
  let title = String(value || '');
  title = title.replace(/[[(]([^\])]+)[\])]/g, (_match, group) => {
    if (shouldDropBracketGroup(group)) return ' ';
    const cleaned = cleanBracketGroup(group);
    return cleaned ? ` ${cleaned} ` : ' ';
  });
  return title;
}

function normalizeTitleArticles(value) {
  return value
    .replace(/\b(the|a|an|of)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function titleTokens(value) {
  const seen = new Set();
  const tokens = normalizeTitleArticles(normalizeToken(value))
    .split(' ')
    .filter(Boolean);
  return tokens.filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

export function normalizeRomTitle(value) {
  const withoutExtension = stripKnownExtension(value).replace(/,\s*the\b/gi, ' ');
  const withoutGroups = stripRomMetadataGroups(withoutExtension);
  return titleTokens(withoutGroups).join(' ');
}

function normalizePlatform(value) {
  const normalized = normalizeToken(value);
  return PLATFORM_ALIASES.get(normalized) || normalized;
}

function normalizeTitle(value) {
  return titleTokens(value).join(' ');
}

function entryTitle(entry) {
  return entry.title || entry.name || entry.game_title || entry.canonical_title || entry.normalizedTitle || entry.filename || '';
}

function entryPlatform(entry) {
  return entry.platform || entry.system || entry.console || entry.core || entry.systemFolder || '';
}

function entryMatchId(entry) {
  return entry.match_id || entry.library_match_id || entry.id || entry.game_id || '';
}

function entryPath(entry) {
  return entry.rom_path || entry.path || entry.file || entry.file_path || entry.absolutePath || entry.relativePath || '';
}

function normalizeEntry(entry) {
  const rawTitle = entryTitle(entry);
  const normalizedTitle = entry.normalizedTitle || (entry.filename ? normalizeRomTitle(rawTitle) : normalizeTitle(rawTitle));
  const normalizedTitleTokens = Array.isArray(entry.normalizedTitleTokens)
    ? entry.normalizedTitleTokens
    : normalizedTitle.split(' ').filter(Boolean);

  return {
    ...entry,
    title: rawTitle,
    platform: entryPlatform(entry),
    match_id: entryMatchId(entry),
    rom_path: entryPath(entry),
    normalizedTitle,
    normalizedTitleTokens,
    normalizedPlatform: normalizePlatform(entryPlatform(entry)),
  };
}

function extractEntries(rawIndex) {
  if (!rawIndex) return [];
  if (Array.isArray(rawIndex)) return rawIndex;
  if (Array.isArray(rawIndex.files)) return rawIndex.files;
  if (Array.isArray(rawIndex.games)) return rawIndex.games;
  if (Array.isArray(rawIndex.entries)) return rawIndex.entries;
  if (Array.isArray(rawIndex.owned)) return rawIndex.owned;
  if (Array.isArray(rawIndex.matches)) return rawIndex.matches;
  return [];
}

export function toOwnedIndex(rawIndex) {
  const entries = extractEntries(rawIndex).map(normalizeEntry).filter((entry) => entry.normalizedTitle || entry.match_id);
  return {
    loaded: Boolean(rawIndex),
    generated_at: rawIndex?.generated_at || rawIndex?.generatedAt || rawIndex?.generatedAt || '',
    source_root: rawIndex?.source_root || rawIndex?.sourceRoot || rawIndex?.source?.root || '',
    entries,
  };
}

function candidateSummary(entry) {
  return {
    id: entry.id || entry.match_id || '',
    title: entry.title,
    platform: entry.platform,
    rom_path: entry.rom_path,
    library_match_id: entry.match_id,
    confidence: entry.confidence,
  };
}

function matchEntry(game, index) {
  const gameMatchId = game.library_match_id || game.libraryMatchId || '';
  if (gameMatchId) {
    const byMatchId = index.entries.find((entry) => entry.match_id && entry.match_id === gameMatchId);
    if (byMatchId) return { status: 'matched', entry: byMatchId, candidates: [byMatchId] };
  }

  const gameTitle = normalizeTitle(game.title);
  const gamePlatform = normalizePlatform(game.platform);
  const titleCandidates = index.entries.filter((entry) => entry.normalizedTitle && entry.normalizedTitle === gameTitle);
  if (titleCandidates.length === 0) return { status: 'missing', candidates: [] };

  const platformCandidates = gamePlatform
    ? titleCandidates.filter((entry) => !entry.normalizedPlatform || entry.normalizedPlatform === gamePlatform)
    : titleCandidates;

  if (platformCandidates.length === 1) return { status: 'matched', entry: platformCandidates[0], candidates: platformCandidates };
  if (platformCandidates.length > 1) return { status: 'ambiguous', candidates: platformCandidates };
  return { status: 'ambiguous', candidates: titleCandidates };
}

export function resolveOwnershipState(game, index) {
  if (game.acquisition_status === 'not_applicable') {
    return {
      status: 'not_applicable',
      label: STATUS_LABELS.not_applicable,
      source: 'Backlog item',
      match_status: 'not_applicable',
    };
  }

  if (!index?.loaded) {
    return {
      status: game.acquisition_status || 'unknown',
      label: STATUS_LABELS[game.acquisition_status] || STATUS_LABELS.unknown,
      source: 'No ownership index loaded',
      rom_path: game.rom_path || '',
      library_match_id: game.library_match_id || '',
      match_status: 'not_loaded',
    };
  }

  const match = matchEntry(game, index);
  if (match.status === 'missing') {
    return {
      status: 'needs_acquiring',
      label: STATUS_LABELS.needs_acquiring,
      source: 'Nexus library match',
      match_status: 'missing',
    };
  }

  if (match.status === 'ambiguous') {
    return {
      status: 'unknown',
      label: STATUS_LABELS.unknown,
      source: 'Nexus library match',
      match_status: 'ambiguous',
      candidates: match.candidates.map(candidateSummary),
    };
  }

  const matchedEntry = match.entry;
  return {
    status: 'owned',
    label: STATUS_LABELS.owned,
    source: 'Nexus library match',
    match_status: 'matched',
    rom_path: matchedEntry.rom_path,
    library_match_id: matchedEntry.match_id,
    confidence: matchedEntry.confidence,
    matched_title: matchedEntry.title,
    matched_platform: matchedEntry.platform,
  };
}

export function mergeOwnershipState(game, index) {
  const ownership = resolveOwnershipState(game, index);
  return {
    ...game,
    acquisition_status: ownership.status,
    rom_path: ownership.rom_path || game.rom_path || '',
    library_match_id: ownership.library_match_id || game.library_match_id || '',
    ownership,
  };
}

export function applyOwnershipIndexToGames(games, index) {
  const report = {
    matched: [],
    missing: [],
    ambiguous: [],
    not_loaded: [],
  };

  const resolvedGames = games.map((game) => {
    const ownership = resolveOwnershipState(game, index);
    const merged = {
      ...game,
      acquisition_status: ownership.status,
      rom_path: ownership.rom_path || game.rom_path || '',
      library_match_id: ownership.library_match_id || game.library_match_id || '',
      ownership,
    };
    const bucket = ownership.match_status === 'matched' ? 'matched' : ownership.match_status;
    if (report[bucket]) report[bucket].push({ game, ownership });
    return merged;
  });

  return { games: resolvedGames, report };
}
