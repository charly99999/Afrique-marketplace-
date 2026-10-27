import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
 * Send SMS OTP via backend API (Twilio / Pan-African SMS Gateway)
 */
export async function sendSMSOTP(phone: string): Promise<{ success: boolean; message: string; simulated?: boolean; otp?: string }> {
  try {
    const res = await fetch('/api/auth/send-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur lors de l’envoi du SMS OTP',
    };
  }
}

/**
 * Verify SMS OTP via backend API
 */
export async function verifySMSOTP(phone: string, code: string): Promise<{ success: boolean; message: string; user?: any }> {
  try {
    const res = await fetch('/api/auth/verify-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur lors de la vérification du code OTP',
    };
  }
}
