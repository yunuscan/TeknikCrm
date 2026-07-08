import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    openModal, closeModal, translateError, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Ana render (sadece Yönetici erisebilir)
// ---------------------------------------------------

export async function renderUsers({ profile }) {
    setPageTitle('Kullanıcılar');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) {
        showToast('Kullanıcılar yuklenemedi: ' + error.message, 'error');
        return;
    }

    setContent(buildHTML(profiles || [], profile));
    bindEvents(profile, profiles || []);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(profiles, currentProfile) {
    const rows = profiles.length
        ? profiles.map(p => buildRow(p, currentProfile)).join('')
        : `<tr><td colspan="6" class="px-5 py-10 text-center text-sm text-gray-400">Kullanıcı bulunamadi.</td></tr>`;

    return `
        <div class="max-w-5xl mx-auto">

            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Kullanıcılar</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${profiles.length} kullanıcı</p>
                </div>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Ad Soyad</th>
                                <th class="px-5 py-3 font-medium">E-posta</th>
                                <th class="px-5 py-3 font-medium">Telefon</th>
                                <th class="px-5 py-3 font-medium">Rol</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                                <th class="px-5 py-3 font-medium text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildModal()}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(p, currentProfile) {
    const isSelf    = p.id === currentProfile?.id;
    const statusCls = p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';
    const statusTxt = p.is_active ? 'Aktif' : 'Pasif';

    const roleCls = {
        'Yönetici':       'bg-indigo-100 text-indigo-800',
        'Teknik Servis':  'bg-blue-100 text-blue-800',
        'Satış Personeli':'bg-purple-100 text-purple-800',
        'Stajyer':        'bg-gray-100 text-gray-600',
    }[p.role] || 'bg-gray-100 text-gray-600';

    const roleElement = isSelf
        ? `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${roleCls}">${escHtml(p.role)}</span>`
        : `
        <select data-action="change-role" data-id="${p.id}"
            class="px-2 py-1 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option value="Yönetici" ${p.role === 'Yönetici' || p.role === 'Yonetici' ? 'selected' : ''}>Yönetici</option>
            <option value="Teknik Servis" ${p.role === 'Teknik Servis' ? 'selected' : ''}>Teknik Servis</option>
            <option value="Satış Personeli" ${p.role === 'Satış Personeli' ? 'selected' : ''}>Satış Personeli</option>
            <option value="Stajyer" ${p.role === 'Stajyer' ? 'selected' : ''}>Stajyer</option>
        </select>
        `;

    return `
        <tr class="hover:bg-slate-50 transition-colors ${isSelf ? 'bg-indigo-50/40' : ''}">
            <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        ${escHtml(p.full_name?.charAt(0)?.toUpperCase() || '?')}
                    </div>
                    <span class="font-medium text-gray-800">${escHtml(p.full_name)}${isSelf ? ' <span class="text-xs text-indigo-500">(siz)</span>' : ''}</span>
                </div>
            </td>
            <td class="px-5 py-3 text-gray-600">${escHtml(p.email)}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(p.phone) || '-'}</td>
            <td class="px-5 py-3">
                ${roleElement}
            </td>
            <td class="px-5 py-3">
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusCls}">${statusTxt}</span>
            </td>
            <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2">
                    <button data-action="edit-user" data-id="${p.id}"
                        class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Duzenle</button>
                    ${!isSelf ? `
                    <button data-action="toggle-active" data-id="${p.id}" data-active="${p.is_active}"
                        class="text-xs px-2.5 py-1.5 rounded-md border ${p.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}">
                        ${p.is_active ? 'Pasife Al' : 'Aktife Al'}
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `;
}

// ---------------------------------------------------
// Modal
// ---------------------------------------------------

function buildModal() {
    return `
        <div id="user-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800">Kullanıcı Duzenle</h3>
                    <button data-close-modal="user-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="user-modal-form" novalidate>
                    <div class="px-6 py-5 space-y-4">

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                            <input type="text" name="full_name" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                            <input type="tel" name="phone"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <select name="role"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Yönetici">Yönetici</option>
                                <option value="Teknik Servis">Teknik Servis</option>
                                <option value="Satış Personeli">Satış Personeli</option>
                                <option value="Stajyer">Stajyer</option>
                            </select>
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="user-modal"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                        <button type="submit"
                            class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-60">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(profile, profiles) {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    document.querySelector('tbody')?.addEventListener('click', async e => {
        const btn    = e.target.closest('[data-action]');
        if (!btn) return;
        const id     = btn.dataset.id;
        const action = btn.dataset.action;
        const user   = profiles.find(p => p.id === id);

        if (action === 'edit-user' && user) {
            document.getElementById('user-modal-form').dataset.editId = id;
            document.getElementById('user-modal-form').querySelector('[name="full_name"]').value = user.full_name || '';
            document.getElementById('user-modal-form').querySelector('[name="phone"]').value     = user.phone    || '';
            
            const roleSelect = document.getElementById('user-modal-form').querySelector('[name="role"]');
            roleSelect.value = user.role || 'Stajyer';
            if (user.id === profile.id) {
                roleSelect.disabled = true;
            } else {
                roleSelect.disabled = false;
            }
            openModal('user-modal');
        }

        if (action === 'toggle-active') {
            const isActive = btn.dataset.active === 'true';
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: !isActive })
                .eq('id', id);
            if (error) { showToast(translateError(error), 'error'); return; }
            showToast(isActive ? 'Kullanıcı pasife alindi.' : 'Kullanıcı aktife alindi.', 'success');
            await renderUsers({ profile });
        }
    });

    document.querySelector('tbody')?.addEventListener('change', async e => {
        const select = e.target.closest('[data-action="change-role"]');
        if (!select) return;
        
        const id = select.dataset.id;
        const newRole = select.value;
        
        if (id === profile.id) {
            showToast('Kendi rolünüzü değiştiremezsiniz!', 'error');
            select.value = profile.role;
            return;
        }
        
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', id);
            
        if (error) {
            showToast(translateError(error), 'error');
            await renderUsers({ profile });
            return;
        }
        
        showToast('Kullanıcı rolü başarıyla güncellendi.', 'success');
        await renderUsers({ profile });
    });

    document.getElementById('user-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const form      = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        const id        = form.dataset.editId;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Kaydediliyor...';

        const fd = new FormData(form);
        const payload = {
            full_name: fd.get('full_name')?.trim() || null,
            phone:     fd.get('phone')?.trim()     || null,
        };

        const roleSelect = form.querySelector('[name="role"]');
        if (!roleSelect.disabled) {
            payload.role = fd.get('role') || 'Stajyer';
        }

        const { error } = await supabase.from('profiles').update(payload).eq('id', id);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';

        if (error) { showToast(translateError(error), 'error'); return; }
        showToast('Kullanıcı güncellendi.', 'success');
        closeModal('user-modal');
        await renderUsers({ profile });
    });
}
