import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  phone?: string
): Promise<AuthResponse> => {
  const redirectUrl = `${window.location.origin}/`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: fullName,
        phone: phone ?? ""
      }
    }
  });

  return {
    user: data.user,
    session: data.session,
    error: error as Error | null
  };
};

export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: data.user,
    session: data.session,
    error: error as Error | null
  };
};