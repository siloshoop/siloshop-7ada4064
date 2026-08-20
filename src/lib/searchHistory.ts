import { supabase } from "@/integrations/supabase/client";

/**
 * Recent search history.
 *
 * Backed entirely by the `search_history` table in the backend — there is no
 * client-side cache. Guests (no session) simply have no history.
 * The backend keeps only the 8 most recent terms per account.
 */

const MAX_ITEMS = 8;
const UPDATED_EVENT = "recent-searches-updated";

const notify = () => {
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
};

const currentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

export const getRecentSearches = async (): Promise<string[]> => {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("search_history")
    .select("term")
    .order("searched_at", { ascending: false })
    .limit(MAX_ITEMS);

  if (error || !data) return [];
  return data.map((row) => row.term);
};

export const addRecentSearch = async (term: string): Promise<string[]> => {
  const value = term.trim();
  if (!value) return getRecentSearches();

  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase.rpc("record_search_term", { _term: value });
  notify();

  if (error || !data) return getRecentSearches();
  return (data as string[]) ?? [];
};

export const removeRecentSearch = async (term: string): Promise<string[]> => {
  const userId = await currentUserId();
  if (!userId) return [];

  await supabase.from("search_history").delete().eq("user_id", userId).eq("term", term);
  notify();
  return getRecentSearches();
};

export const clearRecentSearches = async (): Promise<void> => {
  const userId = await currentUserId();
  if (!userId) return;

  await supabase.from("search_history").delete().eq("user_id", userId);
  notify();
};
