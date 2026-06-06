import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteCloudGame, fetchCloudGames, importCloudGames, upsertCloudGame } from './lib/gamesApi.js';
import {
  ACQUISITION_STATUSES,
  PLAY_STATUSES,
  PRIMARY_PLAY_STATUSES,
  emptyGameForm,
  normalizeGame,
  normalizeImportedGame,
  toGameForm,
} from './lib/gameModel.js';
import { applyOwnershipIndexToGames, mergeOwnershipState, toOwnedIndex } from './lib/ownershipIndex.js';
import { exportGames, parseImport, saveGames } from './lib/storage.js';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';

const PLATFORM_PRESETS = [
  'Steam Deck',
  'Steam',
  'Switch',
  'PS5',
  'Xbox Series X/S',
  'PC',
  'SNES',
  'Game Boy Advance',
  'Nintendo DS',
  '3DS',
];

export default function App() {
  const [games, setGames] = useState([]);
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('sign-in');
  const [syncing, setSyncing] = useState(false);
  const [activeStatus, setActiveStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyGameForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [ownershipIndex, setOwnershipIndex] = useState(() => toOwnedIndex(null));
  const [ownershipIndexNotice, setOwnershipIndexNotice] = useState('No ownership index loaded yet.');
  const fileInputRef = useRef(null);
  const ownershipIndexInputRef = useRef(null);
  const isCloudMode = isSupabaseConfigured && session?.user;

  useEffect(() => {
    if (!isCloudMode) return;
    saveGames(games);
  }, [games, isCloudMode]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthReady(true);
      if (!nextSession) {
        setGames([]);
        resetForm();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadOwnershipIndex() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}owned-index.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rawIndex = await response.json();
        if (!isCurrent) return;
        const nextIndex = toOwnedIndex(rawIndex);
        setOwnershipIndex(nextIndex);
        setOwnershipIndexNotice(
          nextIndex.entries.length
            ? `Loaded ${nextIndex.entries.length} Nexus ownership match${nextIndex.entries.length === 1 ? '' : 'es'}.`
            : 'Ownership index loaded but contains no matches.',
        );
      } catch {
        if (!isCurrent) return;
        setOwnershipIndex(toOwnedIndex(null));
        setOwnershipIndexNotice('Ownership unknown until owned-index.json is generated.');
      }
    }

    loadOwnershipIndex();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!isCloudMode) return;

    async function loadCloudGames() {
      setSyncing(true);
      try {
        const cloudGames = await fetchCloudGames();
        setGames(cloudGames);
        setNotice(cloudGames.length ? 'Synced from Supabase.' : 'Signed in. Add or import games to sync them.');
      } catch (error) {
        setNotice(`Sync failed: ${error.message}`);
      } finally {
        setSyncing(false);
      }
    }

    loadCloudGames();
  }, [isCloudMode]);

  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return games.map((game) => mergeOwnershipState(game, ownershipIndex)).filter((game) => {
      const matchesStatus = activeStatus === 'all' || game.play_status === activeStatus;
      const haystack = [
        game.title,
        game.platform,
        game.priority,
        game.notes,
        game.ownership?.label,
        game.ownership?.rom_path,
        ...(game.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeStatus, games, ownershipIndex, query]);

  const counts = useMemo(() => {
    return games.reduce(
      (acc, game) => {
        acc.all += 1;
        acc[game.play_status] = (acc[game.play_status] || 0) + 1;
        return acc;
      },
      { all: 0, need_to_play: 0, playing: 0, completed: 0, dropped: 0 },
    );
  }, [games]);

  const platformOptions = useMemo(() => {
    const savedPlatforms = games.map((game) => game.platform).filter(Boolean);
    return [...new Set([...savedPlatforms, ...PLATFORM_PRESETS])].sort((a, b) => a.localeCompare(b));
  }, [games]);

  const selectedPlatformGames = useMemo(() => {
    const platform = form.platform.trim().toLowerCase();
    if (!platform) return [];
    return games.filter((game) => game.platform.trim().toLowerCase() === platform);
  }, [form.platform, games]);

  const titleSuggestions = useMemo(() => {
    return selectedPlatformGames
      .filter((game) => game.title)
      .map((game) => game.title)
      .sort((a, b) => a.localeCompare(b));
  }, [selectedPlatformGames]);

  const selectedTitleMatches = useMemo(() => {
    const title = form.title.trim().toLowerCase();
    if (!title) return selectedPlatformGames.slice(0, 4);
    return selectedPlatformGames.filter((game) => game.title.trim().toLowerCase().includes(title)).slice(0, 4);
  }, [form.title, selectedPlatformGames]);

  const exactSelectedGame = useMemo(() => {
    const title = form.title.trim().toLowerCase();
    if (!title) return null;
    return selectedPlatformGames.find((game) => game.title.trim().toLowerCase() === title) || null;
  }, [form.title, selectedPlatformGames]);

  const statusOptionsForForm = editingId && form.play_status === 'dropped' ? PLAY_STATUSES : PRIMARY_PLAY_STATUSES;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyGameForm);
    setEditingId(null);
  }

  async function submitGame(event) {
    event.preventDefault();
    if (!form.platform.trim()) {
      setNotice('Choose a platform/system first.');
      return;
    }

    if (!form.title.trim()) {
      setNotice('Search for or enter a game title next.');
      return;
    }

    const existing = games.find((game) => game.id === editingId);
    const nextGame = normalizeGame(form, existing);

    try {
      if (isCloudMode) {
        const savedGame = await upsertCloudGame(nextGame, session.user.id);
        setGames((current) => {
          const withoutSaved = current.filter((game) => game.id !== savedGame.id);
          return [savedGame, ...withoutSaved];
        });
      } else if (editingId) {
        setGames((current) => current.map((game) => (game.id === editingId ? nextGame : game)));
      } else {
        setGames((current) => [nextGame, ...current]);
      }
      setNotice(editingId ? 'Game updated.' : 'Game added.');
      resetForm();
    } catch (error) {
      setNotice(`Save failed: ${error.message}`);
    }
  }

  function editGame(game) {
    setEditingId(game.id);
    setForm(toGameForm(game));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteGame(id) {
    try {
      if (isCloudMode) await deleteCloudGame(id);
      setGames((current) => current.filter((game) => game.id !== id));
      if (editingId === id) resetForm();
      setNotice('Game deleted.');
    } catch (error) {
      setNotice(`Delete failed: ${error.message}`);
    }
  }

  async function moveGame(id, play_status) {
    const game = games.find((item) => item.id === id);
    if (!game) return;
    const nextGame = { ...game, play_status, updatedAt: new Date().toISOString() };

    setGames((current) => current.map((item) => (item.id === id ? nextGame : item)));

    if (!isCloudMode) return;
    try {
      const savedGame = await upsertCloudGame(nextGame, session.user.id);
      setGames((current) => current.map((item) => (item.id === id ? savedGame : item)));
    } catch (error) {
      setGames((current) => current.map((item) => (item.id === id ? game : item)));
      setNotice(`Move failed: ${error.message}`);
    }
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
      const imported = parseImport(await file.text()).map(normalizeImportedGame);
      if (isCloudMode) {
        const savedGames = await importCloudGames(imported, session.user.id);
        setGames(savedGames);
        setNotice(`Imported and synced ${savedGames.length} games.`);
      } else {
        setGames(imported);
        setNotice(`Imported ${imported.length} games locally.`);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      event.target.value = '';
    }
  }

  async function importOwnershipIndex(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const nextIndex = toOwnedIndex(JSON.parse(await file.text()));
      const preview = applyOwnershipIndexToGames(games, nextIndex);
      setOwnershipIndex(nextIndex);
      setOwnershipIndexNotice(
        `Loaded ${nextIndex.entries.length} library entr${nextIndex.entries.length === 1 ? 'y' : 'ies'} from ${file.name}. ` +
          `${preview.report.matched.length} exact match${preview.report.matched.length === 1 ? '' : 'es'}, ` +
          `${preview.report.ambiguous.length} ambiguous, ${preview.report.missing.length} missing.`,
      );
    } catch (error) {
      setOwnershipIndexNotice(`Could not import ownership index: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setNotice('Supabase needs the anon public key before sign-in can work.');
      return;
    }

    setSyncing(true);
    try {
      const authRequest =
        authMode === 'sign-up'
          ? supabase.auth.signUp({ email: authEmail, password: authPassword })
          : supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      const { error } = await authRequest;
      if (error) throw error;
      setNotice(authMode === 'sign-up' ? 'Account created. Check email if confirmation is enabled.' : 'Signed in.');
      setAuthPassword('');
    } catch (error) {
      setNotice(`Auth failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function signOut() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
    setGames([]);
    resetForm();
    setNotice('Signed out. Sign back in to view your backlog.');
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Personal library tracker</p>
          <h1>Game Backlog</h1>
          <p className="lede">
            Pick a platform first, search your list for the title, then add it with
            the right backlog status in a few seconds.
          </p>
        </div>
        {isCloudMode && (
          <div className="hero-actions">
            <button type="button" className="secondary" onClick={downloadBackup}>
              Export JSON
            </button>
            <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importBackup} />
          </div>
        )}
      </section>

      <section className="panel auth-panel" aria-label="Account and sync">
        {isCloudMode ? (
          <div className="auth-status">
            <div>
              <p className="eyebrow">Cloud sync enabled</p>
              <h2>Signed in</h2>
              <p className="muted">{session.user.email} · {syncing ? 'Syncing…' : 'Synced with Supabase'}</p>
            </div>
            <button type="button" className="secondary" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleAuth}>
            <div>
              <p className="eyebrow">Cloud sync</p>
              <h2>Sign in to sync across devices</h2>
              <p className="muted">
                {isSupabaseConfigured
                  ? 'Sign in is required before the backlog, imports, exports, and library tools are shown.'
                  : 'Supabase URL is set. Add the anon public key to enable the required sign-in.'}
              </p>
            </div>
            <label>
              Email
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="••••••••" />
            </label>
            <div className="auth-actions">
              <button type="submit" className="primary" disabled={syncing}>{authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
              <button type="button" className="ghost" onClick={() => setAuthMode(authMode === 'sign-up' ? 'sign-in' : 'sign-up')}>
                {authMode === 'sign-up' ? 'I already have an account' : 'Create an account'}
              </button>
            </div>
            {notice && <p className="notice auth-notice">{notice}</p>}
          </form>
        )}
      </section>

      {!isAuthReady ? (
        <section className="panel locked-panel" aria-live="polite">
          <p className="eyebrow">Checking session</p>
          <h2>Loading secure backlog…</h2>
          <p className="muted">Your game backlog stays hidden until your Supabase session is confirmed.</p>
        </section>
      ) : !isCloudMode ? (
        <section className="panel locked-panel" aria-live="polite">
          <p className="eyebrow">Login required</p>
          <h2>Sign in to view your game backlog</h2>
          <p className="muted">
            The app no longer exposes local starter data or backlog tools while signed out. After login, your games are loaded
            from Supabase using row-level security tied to your account.
          </p>
        </section>
      ) : (
        <>
      <section className="panel ownership-panel" aria-label="Ownership matching">
        <div>
          <p className="eyebrow">Nexus ownership matching</p>
          <h2>Acquisition state</h2>
          <p className="muted">{ownershipIndexNotice}</p>
        </div>
        <div className="ownership-actions">
          <button type="button" className="secondary" onClick={() => ownershipIndexInputRef.current?.click()}>
            Import ownership index
          </button>
          <input ref={ownershipIndexInputRef} type="file" accept="application/json" hidden onChange={importOwnershipIndex} />
        </div>
      </section>

      <section className="panel form-panel" aria-label="Platform-first add or edit game">
        <form onSubmit={submitGame}>
          <div className="form-header">
            <div>
              <p className="eyebrow">Quick add flow</p>
              <h2>{editingId ? 'Edit game' : '1. Platform  2. Game  3. Status'}</h2>
              <p className="muted">Start with the system so title search and backlog state stay scoped to the right library.</p>
            </div>
            {editingId && (
              <button type="button" className="ghost" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <div className="quick-add-layout">
            <div className="flow-card primary-step">
              <span className="step-pill">1</span>
              <label>
                Platform / system
                <input
                  list="platform-options"
                  value={form.platform}
                  onChange={(event) => updateForm('platform', event.target.value)}
                  placeholder="Steam Deck, Switch, PS5..."
                  autoComplete="off"
                />
              </label>
              <datalist id="platform-options">
                {platformOptions.map((platform) => <option key={platform} value={platform} />)}
              </datalist>
              <p className="helper-text">
                {form.platform.trim()
                  ? `${selectedPlatformGames.length} saved game${selectedPlatformGames.length === 1 ? '' : 's'} on ${form.platform.trim()}.`
                  : 'Choose or type the system before searching for a game.'}
              </p>
            </div>

            <div className="flow-card primary-step">
              <span className="step-pill">2</span>
              <label>
                Search or enter game
                <input
                  list="title-options"
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  placeholder={form.platform.trim() ? 'Hades II' : 'Choose a platform first'}
                  disabled={!form.platform.trim()}
                  autoComplete="off"
                />
              </label>
              <datalist id="title-options">
                {titleSuggestions.map((title) => <option key={title} value={title} />)}
              </datalist>
              <div className="backlog-state" aria-live="polite">
                {!form.platform.trim() ? (
                  <p>Select a platform to unlock title search.</p>
                ) : exactSelectedGame ? (
                  <div>
                    <p className="state-heading">Already in your backlog</p>
                    <strong>{exactSelectedGame.title}</strong>
                    <span>{PLAY_STATUSES.find((status) => status.id === exactSelectedGame.play_status)?.label || 'Need to play'}</span>
                    <button type="button" className="ghost compact" onClick={() => editGame(exactSelectedGame)}>Edit existing</button>
                  </div>
                ) : selectedTitleMatches.length ? (
                  <div>
                    <p className="state-heading">Current {form.platform.trim()} backlog</p>
                    <ul>
                      {selectedTitleMatches.map((game) => (
                        <li key={game.id}>
                          <button type="button" className="link-button" onClick={() => editGame(game)}>{game.title}</button>
                          <span>{PLAY_STATUSES.find((status) => status.id === game.play_status)?.label || 'Need to play'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>No matching game on this platform yet. Add it below.</p>
                )}
              </div>
            </div>

            <div className="flow-card status-step">
              <span className="step-pill">3</span>
              <fieldset>
                <legend>Status</legend>
                <div className="status-choice-grid">
                  {statusOptionsForForm.map((status) => (
                    <label key={status.id} className={`status-choice ${form.play_status === status.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="play_status"
                        value={status.id}
                        checked={form.play_status === status.id}
                        onChange={(event) => updateForm('play_status', event.target.value)}
                      />
                      <span>{status.label}</span>
                      <small>{status.hint}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <details className="optional-details">
            <summary>Optional details</summary>
            <div className="form-grid optional-grid">
              <label>
                Acquisition status
                <select value={form.acquisition_status} onChange={(event) => updateForm('acquisition_status', event.target.value)}>
                  {ACQUISITION_STATUSES.map((acquisition_status) => (
                    <option key={acquisition_status.id} value={acquisition_status.id}>{acquisition_status.label}</option>
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
                Acquired at
                <input type="date" value={form.acquired_at} onChange={(event) => updateForm('acquired_at', event.target.value)} />
              </label>
              <label>
                Tags
                <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="jrpg, cozy, roguelike" />
              </label>
              <label>
                Cover image URL
                <input value={form.coverUrl} onChange={(event) => updateForm('coverUrl', event.target.value)} placeholder="https://..." />
              </label>
              <label>
                Library match ID
                <input value={form.library_match_id} onChange={(event) => updateForm('library_match_id', event.target.value)} placeholder="IGDB, SteamGridDB, local library ID..." />
              </label>
              <label>
                ROM path
                <input value={form.rom_path} onChange={(event) => updateForm('rom_path', event.target.value)} placeholder="/roms/platform/game.ext" />
              </label>
              <label className="wide">
                Source notes
                <textarea value={form.source_notes} onChange={(event) => updateForm('source_notes', event.target.value)} placeholder="Where you got it, store/library details, disc/cart notes..." />
              </label>
              <label className="wide">
                Notes
                <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Why you want to play it, where you left off, completion notes..." />
              </label>
            </div>
          </details>

          <div className="form-footer">
            <button type="submit" className="primary">{editingId ? 'Save changes' : 'Add to backlog'}</button>
            {notice && <span className="notice">{notice}</span>}
          </div>
        </form>
      </section>

      <section className="toolbar" aria-label="Filter games">
        <div className="tabs">
          <button className={activeStatus === 'all' ? 'active' : ''} onClick={() => setActiveStatus('all')}>All <span>{counts.all}</span></button>
          {PLAY_STATUSES.map((play_status) => (
            <button key={play_status.id} className={activeStatus === play_status.id ? 'active' : ''} onClick={() => setActiveStatus(play_status.id)}>
              {play_status.label} <span>{counts[play_status.id]}</span>
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
                    <p className="play_status-label">{PLAY_STATUSES.find((play_status) => play_status.id === game.play_status)?.label}</p>
                    <h3>{game.title}</h3>
                  </div>
                  <strong className={`priority ${game.priority.toLowerCase()}`}>{game.priority}</strong>
                </div>
                <p className="meta">
                  {game.platform || 'No platform yet'}{game.rating ? ` • ${game.rating}` : ''}
                </p>
                <div className={`ownership-badge ${game.ownership?.status || 'unknown'}`}>
                  <span>{game.ownership?.label || 'Unknown'}</span>
                  <small>{game.ownership?.source || 'No ownership index loaded'}</small>
                </div>
                {game.ownership?.match_status === 'ambiguous' && (
                  <details className="ambiguity-report">
                    <summary>{game.ownership.candidates.length} possible library matches — review manually</summary>
                    <ul>
                      {game.ownership.candidates.map((candidate) => (
                        <li key={candidate.id || candidate.rom_path}>
                          <strong>{candidate.title || candidate.id || 'Untitled ROM'}</strong>
                          <span>{candidate.platform || 'Unknown system'}</span>
                          {candidate.rom_path && <small>{candidate.rom_path}</small>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {game.ownership?.rom_path && <p className="ownership-path">{game.ownership.rom_path}</p>}
                {game.notes && <p className="notes">{game.notes}</p>}
                {game.tags?.length > 0 && (
                  <div className="tag-list">
                    {game.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <div className="card-actions">
                  <select value={game.play_status} onChange={(event) => moveGame(game.id, event.target.value)} aria-label={`Move ${game.title}`}>
                    {PLAY_STATUSES.map((play_status) => <option key={play_status.id} value={play_status.id}>{play_status.label}</option>)}
                  </select>
                  <button type="button" className="ghost" onClick={() => editGame(game)}>Edit</button>
                  <button type="button" className="danger" onClick={() => deleteGame(game.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
        </>
      )}
    </main>
  );
}
