import { useEffect, useMemo, useRef, useState } from 'react';
import { exportGames, loadGames, parseImport, saveGames } from './lib/storage.js';

const STATUSES = [
  { id: 'interested', label: 'Interested', hint: 'Games on your radar' },
  { id: 'playing', label: 'Playing', hint: 'Currently in progress' },
  { id: 'played', label: 'Played', hint: 'Finished or archived' },
  { id: 'dropped', label: 'Dropped', hint: 'Paused indefinitely' },
];

const emptyForm = {
  title: '',
  platform: '',
  status: 'interested',
  priority: 'Medium',
  rating: '',
  tags: '',
  coverUrl: '',
  notes: '',
};

const starterGames = [
  {
    id: crypto.randomUUID(),
    title: 'The Legend of Zelda: Tears of the Kingdom',
    platform: 'Switch',
    status: 'interested',
    priority: 'High',
    rating: '',
    tags: ['adventure', 'open world'],
    coverUrl: '',
    notes: 'Starter example — edit or delete me.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Balatro',
    platform: 'Steam Deck',
    status: 'playing',
    priority: 'Medium',
    rating: '',
    tags: ['roguelike', 'cards'],
    coverUrl: '',
    notes: 'Great for short sessions.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function normalizeGame(form, existing = {}) {
  const now = new Date().toISOString();
  return {
    ...existing,
    id: existing.id || crypto.randomUUID(),
    title: form.title.trim(),
    platform: form.platform.trim(),
    status: form.status,
    priority: form.priority,
    rating: form.rating,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    coverUrl: form.coverUrl.trim(),
    notes: form.notes.trim(),
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
}

function toForm(game) {
  return {
    title: game.title || '',
    platform: game.platform || '',
    status: game.status || 'interested',
    priority: game.priority || 'Medium',
    rating: game.rating || '',
    tags: Array.isArray(game.tags) ? game.tags.join(', ') : '',
    coverUrl: game.coverUrl || '',
    notes: game.notes || '',
  };
}

export default function App() {
  const [games, setGames] = useState(() => {
    const saved = loadGames();
    return saved.length ? saved : starterGames;
  });
  const [activeStatus, setActiveStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveGames(games);
  }, [games]);

  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesStatus = activeStatus === 'all' || game.status === activeStatus;
      const haystack = [game.title, game.platform, game.priority, game.notes, ...(game.tags || [])]
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeStatus, games, query]);

  const counts = useMemo(() => {
    return games.reduce(
      (acc, game) => {
        acc.all += 1;
        acc[game.status] = (acc[game.status] || 0) + 1;
        return acc;
      },
      { all: 0, interested: 0, playing: 0, played: 0, dropped: 0 },
    );
  }, [games]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function submitGame(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setNotice('Add a game title first.');
      return;
    }

    if (editingId) {
      setGames((current) =>
        current.map((game) => (game.id === editingId ? normalizeGame(form, game) : game)),
      );
      setNotice('Game updated.');
    } else {
      setGames((current) => [normalizeGame(form), ...current]);
      setNotice('Game added.');
    }
    resetForm();
  }

  function editGame(game) {
    setEditingId(game.id);
    setForm(toForm(game));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteGame(id) {
    setGames((current) => current.filter((game) => game.id !== id));
    if (editingId === id) resetForm();
    setNotice('Game deleted.');
  }

  function moveGame(id, status) {
    setGames((current) =>
      current.map((game) =>
        game.id === id ? { ...game, status, updatedAt: new Date().toISOString() } : game,
      ),
    );
  }

  function downloadBackup() {
    const blob = new Blob([exportGames(games)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-backlog-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Backup exported.');
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseImport(await file.text());
      const now = new Date().toISOString();
      setGames(
        imported.map((game) => ({
          id: game.id || crypto.randomUUID(),
          title: game.title || 'Untitled game',
          platform: game.platform || '',
          status: STATUSES.some((status) => status.id === game.status) ? game.status : 'interested',
          priority: game.priority || 'Medium',
          rating: game.rating || '',
          tags: Array.isArray(game.tags) ? game.tags : [],
          coverUrl: game.coverUrl || '',
          notes: game.notes || '',
          createdAt: game.createdAt || now,
          updatedAt: now,
        })),
      );
      setNotice(`Imported ${imported.length} games.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Personal library tracker</p>
          <h1>Game Backlog</h1>
          <p className="lede">
            A lightweight place to keep the games you want to play, are actively playing,
            and have already played.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="secondary" onClick={downloadBackup}>
            Export JSON
          </button>
          <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importBackup} />
        </div>
      </section>

      <section className="panel form-panel" aria-label="Add or edit game">
        <form onSubmit={submitGame}>
          <div className="form-header">
            <h2>{editingId ? 'Edit game' : 'Add a game'}</h2>
            {editingId && (
              <button type="button" className="ghost" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <div className="form-grid">
            <label>
              Title
              <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Hades II" />
            </label>
            <label>
              Platform
              <input value={form.platform} onChange={(event) => updateForm('platform', event.target.value)} placeholder="Steam Deck, Switch, PS5..." />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
            <label>
              Rating
              <input value={form.rating} onChange={(event) => updateForm('rating', event.target.value)} placeholder="9/10, ★★★★☆, etc." />
            </label>
            <label>
              Tags
              <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="jrpg, cozy, roguelike" />
            </label>
            <label className="wide">
              Cover image URL
              <input value={form.coverUrl} onChange={(event) => updateForm('coverUrl', event.target.value)} placeholder="https://..." />
            </label>
            <label className="wide">
              Notes
              <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Why you want to play it, where you left off, completion notes..." />
            </label>
          </div>

          <div className="form-footer">
            <button type="submit" className="primary">{editingId ? 'Save changes' : 'Add game'}</button>
            {notice && <span className="notice">{notice}</span>}
          </div>
        </form>
      </section>

      <section className="toolbar" aria-label="Filter games">
        <div className="tabs">
          <button className={activeStatus === 'all' ? 'active' : ''} onClick={() => setActiveStatus('all')}>All <span>{counts.all}</span></button>
          {STATUSES.map((status) => (
            <button key={status.id} className={activeStatus === status.id ? 'active' : ''} onClick={() => setActiveStatus(status.id)}>
              {status.label} <span>{counts[status.id]}</span>
            </button>
          ))}
        </div>
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, platform, tag, notes..." />
      </section>

      <section className="game-grid" aria-live="polite">
        {visibleGames.length === 0 ? (
          <div className="empty-state">
            <h2>No games found</h2>
            <p>Add a new game or adjust your filters.</p>
          </div>
        ) : (
          visibleGames.map((game) => (
            <article className="game-card" key={game.id}>
              <div className="cover" style={game.coverUrl ? { backgroundImage: `url(${game.coverUrl})` } : undefined}>
                {!game.coverUrl && <span>{game.title.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="card-body">
                <div className="card-title-row">
                  <div>
                    <p className="status-label">{STATUSES.find((status) => status.id === game.status)?.label}</p>
                    <h3>{game.title}</h3>
                  </div>
                  <strong className={`priority ${game.priority.toLowerCase()}`}>{game.priority}</strong>
                </div>
                <p className="meta">{game.platform || 'No platform yet'}{game.rating ? ` • ${game.rating}` : ''}</p>
                {game.notes && <p className="notes">{game.notes}</p>}
                {game.tags?.length > 0 && (
                  <div className="tag-list">
                    {game.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <div className="card-actions">
                  <select value={game.status} onChange={(event) => moveGame(game.id, event.target.value)} aria-label={`Move ${game.title}`}>
                    {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                  </select>
                  <button type="button" className="ghost" onClick={() => editGame(game)}>Edit</button>
                  <button type="button" className="danger" onClick={() => deleteGame(game.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
