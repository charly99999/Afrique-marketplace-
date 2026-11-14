import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeFetchJson } from './apiClient';

// Guaranteed project configuration
const defaultUrl = 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
const defaultAnonKey = 'sb_publishable_Gd_1w7RmnkKKeQ5RhobaPw_MPrka48J';

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseUrl = envUrl.startsWith('https://wlvzjhpfcvwcgyelpsnx.supabase.co') ? envUrl : defaultUrl;
export const supabaseAnonKey = envKey || defaultAnonKey;

// Persistent Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = true;

/**
 * Send SMS OTP strictly via backend API (no fake client-side OTP bypass).
 */
export async function sendSMSOTP(phone: string): Promise<{ success: boolean; message: string; simulated?: boolean; otp?: string }> {
  try {
    const clean = phone.trim();
    const res = await safeFetchJson<{ success: boolean; message: string; simulated?: boolean; otp?: string }>('/api/auth/send-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: clean }),
    });

    if (res.ok && res.data?.success) {
      return res.data;
    }

    return {
      success: false,
      message: res.data?.message || res.error || 'Service SMS temporairement indisponible. Utilisez la connexion par e-mail et mot de passe.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Impossible de joindre le serveur de vérification SMS.',
    };
  }
}

/**
 * Verify SMS OTP strictly via backend API (no client-side bypass).
 */
export async function verifySMSOTP(phone: string, code: string): Promise<{ success: boolean; message: string; user?: any }> {
  try {
    const cleanPhone = phone.trim();
    const cleanCode = code.trim();

    const res = await safeFetchJson<{ success: boolean; message: string; user?: any }>('/api/auth/verify-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, code: cleanCode }),
    });

    if (res.ok && res.data) {
      return res.data;
    }

    return {
      success: false,
      message: res.data?.message || res.error || 'Code SMS incorrect ou expiré.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Erreur lors de la vérification du code OTP.',
    };
  }
}


