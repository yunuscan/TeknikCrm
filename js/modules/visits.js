import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    statusBadge, openModal, closeModal, buildOptions, translateError, setPageTitle,
} from '../utils.js';
import { buildVisitDetailModal, showVisitDetail } from './details.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderVisits({ profile }) {
    console.log('Aktif Rol:', profile?.role);
    setPageTitle('Ziyaret Planı');

    const [visitsRes, customersRes, staffRes] = await Promise.all([
        supabase
            .from('visits')
            .select('*, customers(id, first_name, last_name, company_name), assigned:profiles!visits_assigned_to_fkey(id, full_name)')
            .order('visit_date', { ascending: false }),
        supabase.from('customers').select('id, first_name, last_name, company_name, address').eq('is_active', true).order('company_name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);

    if (visitsRes.error) {
        showToast('Ziyaretler yuklenemedi: ' + visitsRes.error.message, 'error');
        return;
    }

    const visits    = visitsRes.data    || [];
    const customers = customersRes.data || [];
    const staff     = staffRes.data     || [];

    const canWrite  = ['Yönetici', 'Teknik Servis', 'Satış Personeli'].includes(profile?.role);
    const canDelete = profile?.role === 'Yönetici';

    setContent(buildHTML(visits, customers, staff, canWrite, canDelete, profile));
    bindEvents(profile, customers, staff, visits);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(visits, customers, staff, canWrite, canDelete, profile) {
    const today = new Date().toISOString().split('T')[0];

    const rows = visits.length
        ? visits.map(v => buildRow(v, today, canWrite, canDelete)).join('')
        : `<tr><td colspan="8" class="px-5 py-10 text-center text-sm text-gray-400">Ziyaret kaydi bulunamadi.</td></tr>`;

    const custOptions  = buildOptions(customers, 'id', c => c.company_name || `${c.first_name} ${c.last_name}`);
    const staffOptions = buildOptions(staff, 'id', s => s.full_name);

    return `
        <div class="max-w-7xl mx-auto">

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Ziyaret Planı</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${visits.length} ziyaret kaydi</p>
                </div>
                <button id="btn-open-create"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Yeni Ziyaret
                </button>
            </div>

            <!-- Durum filtresi -->
            <div class="flex gap-2 mb-4">
                <button data-filter="" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 bg-gray-100">Tümü</button>
                <button data-filter="Planlandı" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-sky-200 text-sky-700 hover:bg-sky-50">Planlandı</button>
                <button data-filter="Tamamlandı" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-green-200 text-green-700 hover:bg-green-50">Tamamlandı</button>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Müşteri</th>
                                <th class="px-5 py-3 font-medium">Tarih / Saat</th>
                                <th class="px-5 py-3 font-medium">Amac</th>
                                <th class="px-5 py-3 font-medium">Atanan</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                                ${canWrite ? `<th class="px-5 py-3 font-medium text-right">İşlemler</th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="visit-table-body" class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildModal(custOptions, staffOptions)}
        ${buildVisitDetailModal()}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(v, today, canWrite, canDelete) {
    const customer = v.customers
        ? escHtml(v.customers.company_name || `${v.customers.first_name} ${v.customers.last_name}`)
        : '-';
    const assignee  = v.assigned?.full_name ? escHtml(v.assigned.full_name) : '-';
    const isPast    = v.visit_date && v.visit_date < today && v.status === 'Planlandı';
    const timeStr   = v.visit_time ? v.visit_time.slice(0, 5) : '';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button data-action="edit" data-id="${v.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Duzenle</button>
            ${canDelete ? `<button data-action="delete" data-id="${v.id}" data-name="${escHtml(customer)}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50">Sil</button>` : ''}
        </div>` : '';

    return `
        <tr class="cursor-pointer ${isPast ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-slate-50'} transition-colors" data-status="${escHtml(v.status)}" data-id="${v.id}">
            <td class="px-5 py-3 font-medium text-gray-800">${customer}</td>
            <td class="px-5 py-3">
                <span class="${isPast ? 'text-orange-600 font-semibold' : 'text-gray-700'}">${formatDate(v.visit_date)}</span>
                ${timeStr ? `<span class="ml-2 text-xs text-gray-400">${timeStr}</span>` : ''}
            </td>
            <td class="px-5 py-3 text-gray-600 max-w-xs truncate">${escHtml(v.purpose) || '-'}</td>
            <td class="px-5 py-3 text-gray-600">${assignee}</td>
            <td class="px-5 py-3">${statusBadge(v.status)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Modal
// ---------------------------------------------------

function buildModal(custOptions, staffOptions) {
    return `
        <div id="visit-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="visit-modal-title" class="text-lg font-semibold text-gray-800">Yeni Ziyaret</h3>
                    <button data-close-modal="visit-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="visit-modal-form" novalidate>
                    <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Müşteri <span class="text-red-500">*</span></label>
                            <select name="customer_id" required id="visit-customer-select"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Müşteri secin --</option>
                                ${custOptions}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ziyaret Tarihi <span class="text-red-500">*</span></label>
                            <input type="date" name="visit_date" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                            <input type="time" name="visit_time"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                            <input type="text" name="address" id="visit-address-input"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
                                <option value="Planlandı">Planlandı</option>
                                <option value="Tamamlandı">Tamamlandı</option>
                            </select>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Amac / Notlar</label>
                            <input type="text" name="purpose"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2">
                            <textarea name="notes" rows="2" placeholder="Ek notlar..."
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Yapilan Is</label>
                            <textarea name="work_done" rows="2"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Sonuc</label>
                            <textarea name="result" rows="2"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="visit-modal"
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

function bindEvents(profile, customers, staff, visits) {
    document.getElementById('btn-open-create')?.addEventListener('click', () => {
        document.getElementById('visit-modal-title').textContent = 'Yeni Ziyaret';
        document.getElementById('visit-modal-form').dataset.editId = '';
        document.getElementById('visit-modal-form').reset();
        openModal('visit-modal');
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Müşteri secince adresini otomatik doldur
    document.getElementById('visit-customer-select')?.addEventListener('change', e => {
        const cId      = e.target.value;
        const customer = customers.find(c => c.id === cId);
        const addrInput = document.getElementById('visit-address-input');
        if (addrInput && customer?.address) {
            addrInput.value = customer.address;
        }
    });

    // Durum filtresi
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.filter;
            document.querySelectorAll('tr[data-status]').forEach(row => {
                row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
            });
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('ring-2', 'ring-indigo-300'));
            btn.classList.add('ring-2', 'ring-indigo-300');
        });
    });

    // Tablo tiklama
    document.getElementById('visit-table-body')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
            const id     = btn.dataset.id;
            const action = btn.dataset.action;
            const visit  = visits.find(v => v.id === id);

            if (action === 'edit' && visit) {
                document.getElementById('visit-modal-title').textContent = 'Ziyaret Duzenle';
                document.getElementById('visit-modal-form').dataset.editId = id;
                fillVisitForm(document.getElementById('visit-modal-form'), visit);
                openModal('visit-modal');
            }

            if (action === 'delete') {
                const name = btn.dataset.name;
                if (!confirm(`"${name}" ziyareti silinecek. Emin misiniz?`)) return;
                const { error } = await supabase.from('visits').delete().eq('id', id);
                if (error) { showToast(translateError(error), 'error'); return; }
                showToast('Ziyaret silindi.', 'success');
                await renderVisits({ profile });
            }
            return;
        }

        const row = e.target.closest('tr[data-id]');
        if (row) {
            const id = row.dataset.id;
            const visit = visits.find(v => v.id === id);
            if (visit) {
                showVisitDetail(visit);
            }
        }
    });

    document.getElementById('visit-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveVisit(e.target, profile);
    });
}

// ---------------------------------------------------
// Form doldur
// ---------------------------------------------------

function fillVisitForm(form, v) {
    form.querySelector('[name="customer_id"]').value = v.customer_id || '';
    form.querySelector('[name="visit_date"]').value  = v.visit_date  || '';
    form.querySelector('[name="visit_time"]').value  = v.visit_time  || '';
    form.querySelector('[name="address"]').value     = v.address     || '';
    form.querySelector('[name="assigned_to"]').value = v.assigned_to || '';
    form.querySelector('[name="status"]').value      = v.status      || 'Planlandı';
    form.querySelector('[name="purpose"]').value     = v.purpose     || '';
    form.querySelector('[name="notes"]').value       = v.notes       || '';
    form.querySelector('[name="work_done"]').value   = v.work_done   || '';
    form.querySelector('[name="result"]').value      = v.result      || '';
}

// ---------------------------------------------------
// CRUD - Kaydet
// ---------------------------------------------------

async function saveVisit(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        customer_id:  fd.get('customer_id') || null,
        visit_date:   fd.get('visit_date')  || null,
        visit_time:   fd.get('visit_time')  || null,
        address:      fd.get('address')?.trim()  || null,
        assigned_to:  fd.get('assigned_to') || null,
        status:       fd.get('status')      || 'Planlandı',
        purpose:      fd.get('purpose')?.trim()  || null,
        notes:        fd.get('notes')?.trim()    || null,
        work_done:    fd.get('work_done')?.trim() || null,
        result:       fd.get('result')?.trim()   || null,
    };

    if (!payload.customer_id || !payload.visit_date) {
        showToast('Müşteri ve ziyaret tarihi zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('visits').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            ({ error } = await supabase.from('visits').insert(payload));
        }
        if (error) throw error;
        showToast(editId ? 'Ziyaret güncellendi.' : 'Ziyaret olusturuldu.', 'success');
        closeModal('visit-modal');
        await renderVisits({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
