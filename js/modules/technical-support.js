import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDateTime,
    statusBadge, openModal, closeModal, buildOptions, translateError, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderTechnicalSupport({ profile }) {
    setPageTitle('Teknik Destek');

    const [supportsRes, customersRes, staffRes] = await Promise.all([
        supabase
            .from('technical_supports')
            .select('*, customers(id, first_name, last_name, company_name), assigned:profiles!technical_supports_assigned_to_fkey(id, full_name)')
            .order('created_at', { ascending: false })
            .limit(100),
        supabase.from('customers').select('id, first_name, last_name, company_name').eq('is_active', true).order('company_name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);

    if (supportsRes.error) {
        showToast('Destek kayitlari yuklenemedi: ' + supportsRes.error.message, 'error');
        return;
    }

    const supports  = supportsRes.data  || [];
    const customers = customersRes.data || [];
    const staff     = staffRes.data     || [];

    const canWrite = ['Yonetici', 'Teknik Servis'].includes(profile?.role);

    setContent(buildHTML(supports, customers, staff, canWrite, profile));
    bindEvents(profile, customers, staff, supports);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(supports, customers, staff, canWrite, profile) {
    const rows = supports.length
        ? supports.map(s => buildRow(s, canWrite, profile)).join('')
        : `<tr><td colspan="7" class="px-5 py-10 text-center text-sm text-gray-400">Destek kaydi bulunamadi.</td></tr>`;

    const custOptions  = buildOptions(customers, 'id', c => c.company_name || `${c.first_name} ${c.last_name}`);
    const staffOptions = buildOptions(staff, 'id', s => s.full_name);

    return `
        <div class="max-w-7xl mx-auto">

            <!-- Baslik + Yeni Destek butonu -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Teknik Destek</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${supports.length} kayit listeleniyor</p>
                </div>
                ${canWrite ? `
                <button
                    id="btn-new-support"
                    class="btn-new-support inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-colors"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Yeni Destek
                </button>` : ''}
            </div>

            <!-- Durum filtresi -->
            <div class="flex flex-wrap gap-2 mb-4">
                <button data-filter-status="" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 bg-gray-100">Tumü</button>
                <button data-filter-status="Acik" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50">Acik</button>
                <button data-filter-status="Devam Ediyor" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-orange-200 text-orange-700 hover:bg-orange-50">Devam Ediyor</button>
                <button data-filter-status="Cozuldu" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-green-200 text-green-700 hover:bg-green-50">Cozuldu</button>
                <button data-filter-status="Kapali" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50">Kapali</button>
            </div>

            <!-- Tablo -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">No</th>
                                <th class="px-5 py-3 font-medium">Musteri</th>
                                <th class="px-5 py-3 font-medium">Konu</th>
                                <th class="px-5 py-3 font-medium">Arayan</th>
                                <th class="px-5 py-3 font-medium">Atanan</th>
                                <th class="px-5 py-3 font-medium">Baslangic</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                                ${canWrite ? `<th class="px-5 py-3 font-medium text-right">Islemler</th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="support-table-body" class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildNewSupportModal(custOptions, staffOptions)}
        ${buildDetailModal()}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(s, canWrite, profile) {
    const customer = s.customers
        ? escHtml(s.customers.company_name || `${s.customers.first_name} ${s.customers.last_name}`)
        : '-';
    const assignee = s.assigned?.full_name ? escHtml(s.assigned.full_name) : '-';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button data-action="detail" data-id="${s.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Detay</button>
            <button data-action="edit" data-id="${s.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50">Duzenle</button>
        </div>` : `
        <div><button data-action="detail" data-id="${s.id}"
            class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Detay</button></div>`;

    return `
        <tr class="hover:bg-slate-50 transition-colors" data-status="${escHtml(s.status)}">
            <td class="px-5 py-3">
                <span class="support-number-badge text-indigo-700">#${s.support_number}</span>
            </td>
            <td class="px-5 py-3 font-medium text-gray-800">${customer}</td>
            <td class="px-5 py-3 text-gray-700 max-w-xs truncate">${escHtml(s.subject)}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(s.caller_name)}</td>
            <td class="px-5 py-3 text-gray-600">${assignee}</td>
            <td class="px-5 py-3 text-gray-500 text-xs">${formatDateTime(s.start_time)}</td>
            <td class="px-5 py-3">${statusBadge(s.status)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Yeni Destek Modal
// ---------------------------------------------------

function buildNewSupportModal(custOptions, staffOptions) {
    return `
        <div id="support-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="support-modal-title" class="text-lg font-semibold text-gray-800">Yeni Destek Kaydi</h3>
                    <button data-close-modal="support-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="support-modal-form" novalidate>
                    <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Musteri <span class="text-red-500">*</span></label>
                            <select name="customer_id" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Musteri secin --</option>
                                ${custOptions}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Arayan Kisi <span class="text-red-500">*</span></label>
                            <input type="text" name="caller_name" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Arayan Telefon</label>
                            <input type="tel" name="caller_phone"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Konu <span class="text-red-500">*</span></label>
                            <input type="text" name="subject" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Aciklama</label>
                            <textarea name="description" rows="3"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Atanan Personel</label>
                            <select name="assigned_to"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Secin --</option>
                                ${staffOptions}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select name="status"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Acik">Acik</option>
                                <option value="Devam Ediyor">Devam Ediyor</option>
                                <option value="Cozuldu">Cozuldu</option>
                                <option value="Kapali">Kapali</option>
                            </select>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Cozum Detayi</label>
                            <textarea name="resolution" rows="2"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                            <textarea name="notes" rows="2"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="support-modal"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Iptal</button>
                        <button type="submit"
                            class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-60">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Detay Modal (log girisi icin)
// ---------------------------------------------------

function buildDetailModal() {
    return `
        <div id="support-detail-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="detail-modal-title" class="text-lg font-semibold text-gray-800">Destek Detayi</h3>
                    <button data-close-modal="support-detail-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div id="detail-modal-body" class="px-6 py-5 space-y-4">
                    <!-- Dinamik icerik -->
                </div>
                <div class="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button type="button" data-close-modal="support-detail-modal"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Kapat</button>
                </div>
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(profile, customers, staff, supports) {
    document.getElementById('btn-new-support')?.addEventListener('click', () => {
        document.getElementById('support-modal-title').textContent = 'Yeni Destek Kaydi';
        document.getElementById('support-modal-form').dataset.editId = '';
        document.getElementById('support-modal-form').reset();
        openModal('support-modal');
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Durum filtresi
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.filterStatus;
            document.querySelectorAll('tr[data-status]').forEach(row => {
                row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
            });
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('ring-2', 'ring-indigo-300'));
            btn.classList.add('ring-2', 'ring-indigo-300');
        });
    });

    // Tablo tiklama
    document.getElementById('support-table-body')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id     = btn.dataset.id;
        const action = btn.dataset.action;
        const support = supports.find(s => s.id === id);
        if (!support) return;

        if (action === 'detail') {
            await showDetail(support, profile);
        }

        if (action === 'edit') {
            document.getElementById('support-modal-title').textContent = 'Destek Guncelle';
            fillSupportForm(document.getElementById('support-modal-form'), support);
            document.getElementById('support-modal-form').dataset.editId = id;
            openModal('support-modal');
        }
    });

    // Form gonder
    document.getElementById('support-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveSupport(e.target, profile);
    });
}

// ---------------------------------------------------
// Detay goruntuleme
// ---------------------------------------------------

async function showDetail(s, profile) {
    const { data: logs } = await supabase
        .from('support_logs')
        .select('*, logged_by_profile:profiles!support_logs_logged_by_fkey(full_name)')
        .eq('support_id', s.id)
        .order('created_at', { ascending: true });

    const customer = s.customers
        ? (s.customers.company_name || `${s.customers.first_name} ${s.customers.last_name}`)
        : '-';

    const logItems = (logs || []).map(l => `
        <div class="flex gap-3 text-sm">
            <div class="flex-shrink-0 w-1 bg-indigo-200 rounded-full"></div>
            <div>
                <p class="text-gray-700">${escHtml(l.log_entry)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${escHtml(l.logged_by_profile?.full_name || '-')} &mdash; ${formatDateTime(l.created_at)}</p>
            </div>
        </div>
    `).join('') || '<p class="text-sm text-gray-400">Log girisi bulunmamaktadir.</p>';

    const canLog = ['Yonetici', 'Teknik Servis'].includes(profile?.role);

    document.getElementById('detail-modal-title').textContent = `Destek #${s.support_number}`;
    document.getElementById('detail-modal-body').innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-400 text-xs">Musteri</span><p class="font-medium text-gray-800">${escHtml(customer)}</p></div>
            <div><span class="text-gray-400 text-xs">Durum</span><p class="mt-0.5">${statusBadge(s.status)}</p></div>
            <div><span class="text-gray-400 text-xs">Arayan</span><p class="text-gray-700">${escHtml(s.caller_name)} ${s.caller_phone ? `<span class="text-gray-400">(${escHtml(s.caller_phone)})</span>` : ''}</p></div>
            <div><span class="text-gray-400 text-xs">Baslangic</span><p class="text-gray-700">${formatDateTime(s.start_time)}</p></div>
        </div>
        <div>
            <p class="text-xs text-gray-400 mb-1">Konu</p>
            <p class="text-gray-800 font-medium">${escHtml(s.subject)}</p>
        </div>
        ${s.description ? `<div><p class="text-xs text-gray-400 mb-1">Aciklama</p><p class="text-gray-700 text-sm">${escHtml(s.description)}</p></div>` : ''}
        ${s.resolution ? `<div><p class="text-xs text-gray-400 mb-1">Cozum</p><p class="text-gray-700 text-sm">${escHtml(s.resolution)}</p></div>` : ''}
        <div>
            <p class="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Log Kayitlari</p>
            <div class="space-y-3">${logItems}</div>
        </div>
        ${canLog ? `
        <div class="pt-2 border-t border-gray-100">
            <label class="block text-sm font-medium text-gray-700 mb-1">Yeni Log Girisi</label>
            <textarea id="new-log-entry" rows="2" placeholder="Log notu girin..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
            <button id="btn-add-log" data-support-id="${s.id}"
                class="mt-2 px-4 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300">
                Log Ekle
            </button>
        </div>` : ''}
    `;

    openModal('support-detail-modal');

    document.getElementById('btn-add-log')?.addEventListener('click', async () => {
        const entry = document.getElementById('new-log-entry').value.trim();
        if (!entry) return;
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const { error } = await supabase.from('support_logs').insert({
            support_id: s.id,
            logged_by:  userId,
            log_entry:  entry,
        });
        if (error) { showToast(translateError(error), 'error'); return; }
        showToast('Log eklendi.', 'success');
        document.getElementById('new-log-entry').value = '';
        await showDetail(s, profile);
    });
}

// ---------------------------------------------------
// Form doldur
// ---------------------------------------------------

function fillSupportForm(form, s) {
    form.querySelector('[name="customer_id"]').value  = s.customer_id  || '';
    form.querySelector('[name="caller_name"]').value  = s.caller_name  || '';
    form.querySelector('[name="caller_phone"]').value = s.caller_phone || '';
    form.querySelector('[name="subject"]').value      = s.subject      || '';
    form.querySelector('[name="description"]').value  = s.description  || '';
    form.querySelector('[name="assigned_to"]').value  = s.assigned_to  || '';
    form.querySelector('[name="status"]').value       = s.status       || 'Acik';
    form.querySelector('[name="resolution"]').value   = s.resolution   || '';
    form.querySelector('[name="notes"]').value        = s.notes        || '';
}

// ---------------------------------------------------
// CRUD - Kaydet
// ---------------------------------------------------

async function saveSupport(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        customer_id:  fd.get('customer_id')        || null,
        caller_name:  fd.get('caller_name')?.trim() || null,
        caller_phone: fd.get('caller_phone')?.trim() || null,
        subject:      fd.get('subject')?.trim()     || null,
        description:  fd.get('description')?.trim() || null,
        assigned_to:  fd.get('assigned_to')         || null,
        status:       fd.get('status')              || 'Acik',
        resolution:   fd.get('resolution')?.trim()  || null,
        notes:        fd.get('notes')?.trim()        || null,
    };

    if (!payload.customer_id || !payload.caller_name || !payload.subject) {
        showToast('Musteri, arayan kisi ve konu zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    // Durum Cozuldu/Kapali ise bitis zamanini ayarla
    if (['Cozuldu', 'Kapali'].includes(payload.status) && !editId) {
        payload.end_time = new Date().toISOString();
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('technical_supports').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            ({ error } = await supabase.from('technical_supports').insert(payload));
        }
        if (error) throw error;
        showToast(editId ? 'Destek guncellendi.' : 'Destek kaydi olusturuldu.', 'success');
        closeModal('support-modal');
        await renderTechnicalSupport({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
