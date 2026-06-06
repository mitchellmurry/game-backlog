import { fromDatabaseRow, toDatabaseRow } from './gameModel.js';
import { supabase } from './supabase.js';

export async function fetchCloudGames() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data.map(fromDatabaseRow);
}

export async function upsertCloudGame(game, userId) {
  const { data, error } = await supabase
    .from('games')
    .upsert(toDatabaseRow(game, userId))
    .select()
    .single();

  if (error) throw error;
  return fromDatabaseRow(data);
}

export async function deleteCloudGame(id) {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
}

export async function importCloudGames(games, userId) {
  const rows = games.map((game) => toDatabaseRow(game, userId));
  const { data, error } = await supabase.from('games').upsert(rows).select();
  if (error) throw error;
  return data.map(fromDatabaseRow);
}
