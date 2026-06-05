import { supabase } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform || '',
    status: row.status,
    priority: row.priority,
    rating: row.rating || '',
    tags: row.tags || [],
    coverUrl: row.cover_url || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(game, userId) {
  return {
    id: game.id,
    user_id: userId,
    title: game.title,
    platform: game.platform || null,
    status: game.status,
    priority: game.priority,
    rating: game.rating || null,
    tags: game.tags || [],
    cover_url: game.coverUrl || null,
    notes: game.notes || null,
    created_at: game.createdAt,
    updated_at: game.updatedAt,
  };
}

export async function fetchCloudGames() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data.map(fromRow);
}

export async function upsertCloudGame(game, userId) {
  const { data, error } = await supabase
    .from('games')
    .upsert(toRow(game, userId))
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function deleteCloudGame(id) {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
}

export async function importCloudGames(games, userId) {
  const rows = games.map((game) => toRow(game, userId));
  const { data, error } = await supabase.from('games').upsert(rows).select();
  if (error) throw error;
  return data.map(fromRow);
}
