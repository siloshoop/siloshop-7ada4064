import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simple hash function for rate limiting (not cryptographic, just for deduplication)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

interface UseRateLimitReturn {
  checkRateLimit: (email: string) => Promise<boolean>;
  recordSubmission: (email: string) => Promise<void>;
  isChecking: boolean;
}

export function useRateLimit(): UseRateLimitReturn {
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = useCallback(async (email: string): Promise<boolean> => {
    setIsChecking(true);
    try {
      const emailHash = simpleHash(email.toLowerCase().trim());
      
      const { data, error } = await supabase
        .rpc('check_contact_rate_limit', { p_email_hash: emailHash });
      
      if (error) {
        console.error('Rate limit check error:', error);
        // Allow submission if rate limit check fails
        return true;
      }
      
      return data === true;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const recordSubmission = useCallback(async (email: string): Promise<void> => {
    try {
      const emailHash = simpleHash(email.toLowerCase().trim());
      const ipHash = simpleHash(navigator.userAgent + window.screen.width);
      
      await supabase
        .from('contact_rate_limits')
        .insert([{ email_hash: emailHash, ip_hash: ipHash }]);
    } catch (error) {
      console.error('Rate limit record error:', error);
    }
  }, []);

  return { checkRateLimit, recordSubmission, isChecking };
}
