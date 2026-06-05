const STORAGE_KEY = 'game-backlog:v1';

export function loadGames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Could not load game backlog', error);
    return [];
  }
}

export function saveGames(games) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

export function exportGames(games) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'game-backlog',
      version: 1,
      games,
    },
    null,
    2,
  );
}

export function parseImport(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.games)) return parsed.games;
  throw new Error('Import file must contain an array of games or a { games: [...] } object.');
}
