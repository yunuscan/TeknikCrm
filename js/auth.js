import { supabase } from './supabase-config.js';

// ---------------------------------------------------
// Kimlik dogrulama islemleri
// ---------------------------------------------------

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function sendPasswordResetEmail(email) {
    const redirectTo = `${window.location.origin}/index.html`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
}

export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

// ---------------------------------------------------
// Oturum ve profil
// ---------------------------------------------------

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

// ---------------------------------------------------
// Yardimci fonksiyonlar
// ---------------------------------------------------

export function getInitials(fullName) {
    if (!fullName) return '?';
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
}

export function canAccess(userRole, allowedRoles) {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(userRole);
}
