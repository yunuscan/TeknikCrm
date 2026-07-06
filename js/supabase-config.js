import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase proje bilgilerinizi buraya girin.
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL      = 'https://pxymgiwdnorqtirsmmqx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4eW1naXdkbm9ycXRpcnNtbXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTg5NDksImV4cCI6MjA5ODU3NDk0OX0.bA9H3M3csDp0Vw1jAX-78tZSXKMhRIqhkRrZmqYGeGo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true,
    },
});
