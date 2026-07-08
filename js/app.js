// ============================================================
// app.js - Ana kontrolor
// Oturum yonetimi, sayfa yonlendirme, sidebar yonetimi
// ============================================================

import { supabase }              from './supabase-config.js';
import { getSession, fetchProfile, getInitials, signOut } from './auth.js';
import { showLoading, showToast } from './utils.js';

import { renderDashboard }        from './modules/dashboard.js';
import { renderCustomers }        from './modules/customers.js';
import { renderTechnicalSupport } from './modules/technical-support.js';
import { renderTasks }            from './modules/tasks.js';
import { renderCalendar }         from './modules/calendar.js';
import { renderVisits }           from './modules/visits.js';
import { renderReports }          from './modules/reports.js';
import { renderUsers }            from './modules/users.js';
import { renderSettings }         from './modules/settings.js';

// ---------------------------------------------------
// Uygulama durumu
// ---------------------------------------------------

let currentProfile = null;
let currentView    = null;

// ---------------------------------------------------
// Rota tablosu
// handler: Modülden import edilen render fonksiyonu
// roles:   Bos dizi = herkes erisebilir
// ---------------------------------------------------

const ROUTES = {
    dashboard:          { handler: renderDashboard,        roles: [] },
    customers:          { handler: renderCustomers,         roles: [] },
    sales:              { handler: renderSalesPlaceholder,  roles: ['Yonetici', 'Satis Personeli'] },
    'technical-support': { handler: renderTechnicalSupport, roles: [] },
    calendar:           { handler: renderCalendar,          roles: [] },
    tasks:              { handler: renderTasks,             roles: [] },
    visits:             { handler: renderVisits,            roles: [] },
    reports:            { handler: renderReports,           roles: ['Yonetici'] },
    users:              { handler: renderUsers,             roles: ['Yonetici'] },
    settings:           { handler: renderSettings,          roles: [] },
};

// ---------------------------------------------------
// Navigasyon
// ---------------------------------------------------

export function navigate(view) {
    const route = ROUTES[view];
    if (!route) {
        navigate('dashboard');
        return;
    }

    if (route.roles.length > 0) {
        const hasAccess = route.roles.some(r => {
            if (r === 'Yönetici' || r === 'Yonetici') {
                return currentProfile?.role === 'Yönetici' || currentProfile?.role === 'Yonetici';
            }
            return r === currentProfile?.role;
        });
        if (!hasAccess) {
            showToast('Bu sayfaya erisim yetkiniz bulunmamaktadir.', 'error');
            return;
        }
    }

    currentView = view;
    updateSidebarActive(view);
    showLoading();

    route.handler({ profile: currentProfile }).catch(err => {
        console.error(`[Route Error] ${view}:`, err);
        document.getElementById('content-area').innerHTML = `
            <div class="p-8 text-red-600">
                <p class="font-semibold">Sayfa yuklenirken hata olustu.</p>
                <p class="text-sm mt-1 text-red-500">${err.message || String(err)}</p>
            </div>
        `;
    });
}

export function getCurrentProfile() {
    return currentProfile;
}

// ---------------------------------------------------
// Sidebar aktif durumu guncelle
// ---------------------------------------------------

function updateSidebarActive(view) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.remove('bg-indigo-50', 'text-indigo-700', 'font-semibold');
        const svg = el.querySelector('svg');
        if (svg) {
            svg.classList.remove('text-indigo-600');
            svg.classList.add('text-gray-400');
        }
    });

    const active = document.querySelector(`.sidebar-item[data-view="${view}"]`);
    if (active) {
        active.classList.add('bg-indigo-50', 'text-indigo-700', 'font-semibold');
        const svg = active.querySelector('svg');
        if (svg) {
            svg.classList.remove('text-gray-400');
            svg.classList.add('text-indigo-600');
        }
    }
}

// ---------------------------------------------------
// Rol bazli menu gorunurlugu
// ---------------------------------------------------

function applyMenuVisibility(role) {
    document.querySelectorAll('[data-requires-role]').forEach(li => {
        const allowed = li.dataset.requiresRole.split(',').map(r => r.trim());
        const hasAccess = allowed.some(r => {
            if (r === 'Yönetici' || r === 'Yonetici') {
                return role === 'Yönetici' || role === 'Yonetici';
            }
            return r === role;
        });
        if (!hasAccess) {
            li.classList.add('hidden');
        } else {
            li.classList.remove('hidden');
        }
    });
}

// ---------------------------------------------------
// Navbar kullanici bilgilerini doldur
// ---------------------------------------------------

function populateNavbar(profile) {
    const initials = getInitials(profile.full_name);

    document.getElementById('user-avatar').textContent   = initials;
    document.getElementById('nav-user-name').textContent  = profile.full_name;
    document.getElementById('dd-name').textContent        = profile.full_name;
    document.getElementById('dd-email').textContent       = profile.email;

    const badge = document.getElementById('user-role-badge');
    badge.textContent = profile.role;
    badge.classList.remove('hidden');
}

// ---------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------

function initSidebarToggle() {
    const btn     = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
    });

    // Kucuk ekranda sidebar disina tiklayinca kapat
    document.addEventListener('click', e => {
        if (
            window.innerWidth < 640 &&
            !sidebar.contains(e.target) &&
            !btn.contains(e.target) &&
            !sidebar.classList.contains('-translate-x-full')
        ) {
            sidebar.classList.add('-translate-x-full');
        }
    });
}

// ---------------------------------------------------
// Kullanici menu dropdown toggle
// ---------------------------------------------------

function initUserMenu() {
    const btn      = document.getElementById('btn-user-menu');
    const dropdown = document.getElementById('user-dropdown');

    btn.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });

    document.getElementById('btn-signout').addEventListener('click', async e => {
        e.preventDefault();
        try {
            await signOut();
            window.location.replace('login.html');
        } catch {
            showToast('Cikis yapilirken bir hata olustu.', 'error');
        }
    });
}

// ---------------------------------------------------
// Navigasyon event delegation (data-view linkleri)
// ---------------------------------------------------

function initNavigation() {
    document.addEventListener('click', e => {
        const link = e.target.closest('[data-view]');
        if (!link) return;
        e.preventDefault();
        navigate(link.dataset.view);

        // Mobilde tiklama sonrasi sidebar'i kapat
        if (window.innerWidth < 640) {
            document.getElementById('sidebar').classList.add('-translate-x-full');
        }
    });
}

// ---------------------------------------------------
// Satislar placeholder (modul henuz hazir degil)
// ---------------------------------------------------

async function renderSalesPlaceholder() {
    document.getElementById('content-area').innerHTML = `
        <div class="p-8">
            <h1 class="text-2xl font-bold text-gray-800 mb-2">Satislar</h1>
            <p class="text-gray-500">Bu modul gelistirme asamasindadir.</p>
        </div>
    `;
}

// ---------------------------------------------------
// Uygulama baslangici
// ---------------------------------------------------

async function init() {
    const session = await getSession();

    if (!session) {
        window.location.replace('login.html');
        return;
    }

    try {
        const profile = await fetchProfile(session.user.id);

        if (!profile.is_active) {
            await signOut();
            window.location.replace('login.html?reason=inactive');
            return;
        }

        currentProfile = profile;

        populateNavbar(profile);
        applyMenuVisibility(profile.role);
        initSidebarToggle();
        initUserMenu();
        initNavigation();

        // Oturum bitis olayini dinle
        supabase.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT') {
                window.location.replace('login.html');
            }
        });

        // Ücret veya destek güncellendiğinde aktif görünümü yenile
        window.addEventListener('support-updated', () => {
            if (currentView) {
                navigate(currentView);
            }
        });

        // Varsayilan sayfa: dashboard
        navigate('dashboard');

    } catch (err) {
        console.error('[Init Error]', err);
        try {
            await signOut();
        } catch (e) {
            console.error('Signout failed during init error handling:', e);
        }
        window.location.replace('login.html?reason=profile_error');
    }
}

document.addEventListener('DOMContentLoaded', init);
