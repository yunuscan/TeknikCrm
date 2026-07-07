import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    openModal, closeModal, buildOptions, translateError, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderLicenses({ profile }) {
    console.log('Aktif Rol:', profile?.role);
    setPageTitle('Lisanslar');

    const { data, error } = await supabase
        .from('licenses')
        .select('*, customers(id, first_name, last_name, company_name)')
        .order('maintenance_end', { ascending: true, nullsFirst: false });

    if (error) {
        showToast('Lisanslar yuklenemedi: ' + error.message, 'error');
        return;
    }

    const { data: customers } = await supabase
        .from('customers')
        .select('id, first_name, last_name, company_name')
        .eq('is_active', true)
        .order('company_name', { ascending: true, nullsFirst: false });

    const licenses  = data || [];
    const today     = new Date().toISOString().split('T')[0];
    const warnDate  = new Date(); warnDate.setDate(warnDate.getDate() + 30);
    const warnStr   = warnDate.toISOString().split('T')[0];

    const canWrite  = ['Yönetici', 'Satış Personeli'].includes(profile?.role);
    const canDelete = profile?.role === 'Yönetici';

    const rows = licenses.length
        ? licenses.map(l => buildRow(l, today, warnStr, canWrite, canDelete)).join('')
        : `<tr><td colspan="7" class="px-5 py-10 text-center text-sm text-gray-400">Kayıt bulunamadi.</td></tr>`;

    setContent(`
        <div class="max-w-7xl mx-auto">

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Lisanslar</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${licenses.length} lisans kaydi</p>
                </div>
                <button id="btn-open-create"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Yeni Lisans
                </button>
            </div>

            <!-- Renk aciklamasi -->
            <div class="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-100 inline-block border border-red-200"></span> Bakimi gecmis</span>
                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-yellow-50 inline-block border border-yellow-200"></span> 30 gun icinde bitiyor</span>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Lisans No</th>
                                <th class="px-5 py-3 font-medium">Müşteri</th>
                                <th class="px-5 py-3 font-medium">Program</th>
                                <th class="px-5 py-3 font-medium">Versiyon</th>
                                <th class="px-5 py-3 font-medium">Satış Tarihi</th>
                                <th class="px-5 py-3 font-medium">Bakim Bitiş</th>
                                ${canWrite ? `<th class="px-5 py-3 font-medium text-right">İşlemler</th>` : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildModal(customers || [])}
    `);

    bindEvents(profile, customers || [], licenses);
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(l, today, warnStr, canWrite, canDelete) {
    const customer = l.customers
        ? escHtml(l.customers.company_name || `${l.customers.first_name} ${l.customers.last_name}`)
        : '-';

    let rowCls = 'hover:bg-slate-50';
    if (l.maintenance_end && l.maintenance_end < today) rowCls = 'bg-red-50 hover:bg-red-100';
    else if (l.maintenance_end && l.maintenance_end <= warnStr) rowCls = 'bg-yellow-50 hover:bg-yellow-100';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button data-action="edit" data-id="${l.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Duzenle</button>
            ${canDelete ? `<button data-action="delete" data-id="${l.id}" data-name="${escHtml(l.license_number)}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50">Sil</button>` : ''}
        </div>` : '';

    return `
        <tr class="${rowCls} transition-colors">
            <td class="px-5 py-3 font-mono font-semibold text-gray-800">${escHtml(l.license_number)}</td>
            <td class="px-5 py-3 text-gray-600">${customer}</td>
            <td class="px-5 py-3 text-gray-700 font-medium">${escHtml(l.program_name)}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(l.version) || '-'}</td>
            <td class="px-5 py-3 text-gray-600">${formatDate(l.sale_date)}</td>
            <td class="px-5 py-3 font-medium ${l.maintenance_end && l.maintenance_end < today ? 'text-red-600' : 'text-gray-700'}">${formatDate(l.maintenance_end)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Modal
// ---------------------------------------------------

function buildModal(customers) {
    const custOptions = buildOptions(
        customers,
        'id',
        c => c.company_name || `${c.first_name} ${c.last_name}`,
    );

    return `
        <div id="license-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 overflow-y-auto max-h-screen">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="license-modal-title" class="text-lg font-semibold text-gray-800">Yeni Lisans</h3>
                    <button data-close-modal="license-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="license-modal-form" novalidate>
                    <div id="license-modal-body" class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Müşteri <span class="text-red-500">*</span></label>
                            <select name="customer_id" required
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Müşteri secin --</option>
                                ${custOptions}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Lisans No <span class="text-red-500">*</span></label>
                            <input type="text" name="license_number" required
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Program Adi <span class="text-red-500">*</span></label>
                            <input type="text" name="program_name" required
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Versiyon</label>
                            <input type="text" name="version"
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Satış Tarihi</label>
                            <input type="date" name="sale_date"
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Bakim Başlangıç</label>
                            <input type="date" name="maintenance_start"
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Bakim Bitiş</label>
                            <input type="date" name="maintenance_end"
                                class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="license-modal"
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

function bindEvents(profile, customers, licenses) {
    document.getElementById('btn-open-create')?.addEventListener('click', () => {
        document.getElementById('license-modal-title').textContent = 'Yeni Lisans';
        document.getElementById('license-modal-form').dataset.editId = '';
        resetForm(document.getElementById('license-modal-form'));
        openModal('license-modal');
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    document.querySelector('tbody')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id     = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'edit') {
            const lic = licenses.find(l => l.id === id);
            if (!lic) return;
            document.getElementById('license-modal-title').textContent = 'Lisans Duzenle';
            document.getElementById('license-modal-form').dataset.editId = id;
            fillForm(document.getElementById('license-modal-form'), lic);
            openModal('license-modal');
        }

        if (action === 'delete') {
            const name = btn.dataset.name;
            if (!confirm(`"${name}" lisansi silinecek. Emin misiniz?`)) return;
            const { error } = await supabase.from('licenses').delete().eq('id', id);
            if (error) { showToast(translateError(error), 'error'); return; }
            showToast('Lisans silindi.', 'success');
            await renderLicenses({ profile });
        }
    });

    document.getElementById('license-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveLicense(e.target, profile);
    });
}

// ---------------------------------------------------
// Form doldur / sifirla
// ---------------------------------------------------

function fillForm(form, l) {
    form.querySelector('[name="customer_id"]').value        = l.customer_id       || '';
    form.querySelector('[name="license_number"]').value     = l.license_number    || '';
    form.querySelector('[name="program_name"]').value       = l.program_name      || '';
    form.querySelector('[name="version"]').value            = l.version           || '';
    form.querySelector('[name="sale_date"]').value          = l.sale_date         || '';
    form.querySelector('[name="maintenance_start"]').value  = l.maintenance_start || '';
    form.querySelector('[name="maintenance_end"]').value    = l.maintenance_end   || '';
}

function resetForm(form) {
    form.querySelectorAll('input, select, textarea').forEach(el => { el.value = ''; });
}

// ---------------------------------------------------
// CRUD - Kaydet
// ---------------------------------------------------

async function saveLicense(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        customer_id:       fd.get('customer_id')       || null,
        license_number:    fd.get('license_number')?.trim()   || null,
        program_name:      fd.get('program_name')?.trim()     || null,
        version:           fd.get('version')?.trim()          || null,
        sale_date:         fd.get('sale_date')         || null,
        maintenance_start: fd.get('maintenance_start') || null,
        maintenance_end:   fd.get('maintenance_end')   || null,
    };

    if (!payload.customer_id || !payload.license_number || !payload.program_name) {
        showToast('Müşteri, lisans no ve program adi zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('licenses').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            ({ error } = await supabase.from('licenses').insert(payload));
        }
        if (error) throw error;
        showToast(editId ? 'Lisans güncellendi.' : 'Lisans olusturuldu.', 'success');
        closeModal('license-modal');
        await renderLicenses({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
