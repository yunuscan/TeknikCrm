import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Node.js < 22 WebSocket global polyfill for Supabase Realtime client compatibility
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
}

let supabaseInstance = null;

export function getSupabaseClient() {
    if (supabaseInstance) return supabaseInstance;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    return supabaseInstance;
}
