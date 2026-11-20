import { supabase } from "@/integrations/supabase/client";

export const STORE_NAME_TAKEN_MESSAGE = "اسم المتجر مستخدم من متجر آخر، اختر اسمًا مختلفًا";

/**
 * Mirrors public.normalize_store_name for instant feedback only; the database
 * trigger on seller_applications is the real guard.
 */
export const normalizeStoreName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");

/** True when a save failed because another seller already uses the name. */
export const isStoreNameTakenError = (error: unknown) => {
  const e = error as { message?: string; code?: string } | null;
  return !!e && (e.message?.includes("store_name_taken") ?? false);
};

/** Readable Arabic message for a failed store save. */
export const storeSaveErrorMessage = (error: unknown, fallback = "حاول مجددًا") => {
  if (isStoreNameTakenError(error)) return STORE_NAME_TAKEN_MESSAGE;
  const message = (error as { message?: string } | null)?.message;
  return message || fallback;
};

/** Asks the server whether the name is free for the current user (their own store name counts as free). */
export const checkStoreNameAvailable = async (name: string): Promise<boolean | null> => {
  if (!normalizeStoreName(name)) return null;
  const { data, error } = await supabase.rpc("is_store_name_available", { _name: name });
  if (error || typeof data !== "boolean") return null;
  return data;
};
