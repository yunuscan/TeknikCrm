import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    openModal, closeModal, buildOptions, translateError, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Durum
// ---------------------------------------------------

let allCustomers = [];
let searchTerm   = '';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderCustomers({ profile }) {
    setPageTitle('Müşteriler');

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true, nullsFirst: false });

    if (error) {
        showToast('Müşteriler yuklenemedi: ' + error.message, 'error');
        return;
    }

    allCustomers = data || [];
    renderList(profile);
}

// ---------------------------------------------------
// Liste goruntuleme
// ---------------------------------------------------

function renderList(profile) {
    const filtered = filterCustomers(allCustomers, searchTerm);

    const canWrite = ['Yönetici', 'Satış Personeli', 'Teknik Servis'].includes(profile?.role);
    const canDelete = profile?.role === 'Yönetici';

    const rows = filtered.length
        ? filtered.map(c => buildRow(c, canWrite, canDelete)).join('')
        : `<tr><td colspan="7" class="px-5 py-10 text-center text-sm text-gray-400">Kayıt bulunamadi.</td></tr>`;

    setContent(`
        <div class="max-w-7xl mx-auto">

            <!-- Başlık satiri -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Müşteriler</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${allCustomers.length} müşteri kaydi</p>
                </div>
                ${canWrite ? `
                <button
                    id="btn-open-create"
                    class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-colors"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Yeni Müşteri
                </button>` : ''}
            </div>

            <!-- Arama -->
            <div class="mb-4">
                <input
                    type="text"
                    id="search-input"
                    value="${escHtml(searchTerm)}"
                    placeholder="Ad, firma veya telefon ile ara..."
                    class="w-full sm:w-80 px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
            </div>

            <!-- Tablo -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Firma / Ad Soyad</th>
                                <th class="px-5 py-3 font-medium">Telefon</th>
                                <th class="px-5 py-3 font-medium">Il / Ilce</th>
                                <th class="px-5 py-3 font-medium">Yetkili</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                                <th class="px-5 py-3 font-medium">Kayıt Tarihi</th>
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

        ${buildModal('customer-modal', 'Yeni Müşteri', buildForm())}
    `);

    bindEvents(profile);
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(c, canWrite, canDelete) {
    const name = c.company_name
        ? escHtml(c.company_name)
        : `${escHtml(c.first_name)} ${escHtml(c.last_name)}`;

    const sub = c.company_name
        ? `<span class="text-xs text-gray-400">${escHtml(c.first_name)} ${escHtml(c.last_name)}</span>`
        : '';

    const location = [c.province, c.district].filter(Boolean).map(escHtml).join(' / ') || '-';
    const statusCls = c.is_active
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-500';
    const statusTxt = c.is_active ? 'Aktif' : 'Pasif';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button
                data-action="edit"
                data-id="${c.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >Duzenle</button>
            ${canDelete ? `
            <button
                data-action="delete"
                data-id="${c.id}"
                data-name="${escHtml(c.company_name || c.first_name)}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >Sil</button>` : ''}
        </div>
    ` : '';

    return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-3">
                <div class="font-medium text-gray-800">${name}</div>
                ${sub}
            </td>
            <td class="px-5 py-3 text-gray-600">${escHtml(c.phone)}</td>
            <td class="px-5 py-3 text-gray-600">${location}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(c.authorized_person) || '-'}</td>
            <td class="px-5 py-3">
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusCls}">${statusTxt}</span>
            </td>
            <td class="px-5 py-3 text-gray-500">${formatDate(c.created_at)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Form HTML
// ---------------------------------------------------

function buildForm(c = {}) {
    return `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Ad <span class="text-red-500">*</span></label>
                <input type="text" name="first_name" value="${escHtml(c.first_name)}" required
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Soyad <span class="text-red-500">*</span></label>
                <input type="text" name="last_name" value="${escHtml(c.last_name)}" required
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Firma Unvani</label>
                <input type="text" name="company_name" value="${escHtml(c.company_name)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Vergi No</label>
                <input type="text" name="tax_number" value="${escHtml(c.tax_number)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Vergi Dairesi</label>
                <input type="text" name="tax_office" value="${escHtml(c.tax_office)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Telefon <span class="text-red-500">*</span></label>
                <input type="tel" name="phone" value="${escHtml(c.phone)}" required
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Yetkili Kisi</label>
                <input type="text" name="authorized_person" value="${escHtml(c.authorized_person)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Il</label>
                <input type="text" name="province" value="${escHtml(c.province)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Ilce</label>
                <input type="text" name="district" value="${escHtml(c.district)}"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                <textarea name="address" rows="2"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(c.address)}</textarea>
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Ozel Notlar</label>
                <textarea name="notes" rows="2"
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(c.notes)}</textarea>
            </div>

            <div class="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is-active-check" name="is_active" ${c.is_active !== false ? 'checked' : ''}
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <label for="is-active-check" class="text-sm font-medium text-gray-700">Aktif müşteri</label>
            </div>

        </div>
    `;
}

// ---------------------------------------------------
// Modal yapisi
// ---------------------------------------------------

function buildModal(id, title, bodyHtml) {
    return `
        <div
            id="${id}"
            class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true"
        >
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="${id}-title" class="text-lg font-semibold text-gray-800">${title}</h3>
                    <button data-close-modal="${id}" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="${id}-form" novalidate>
                    <div id="${id}-body" class="px-6 py-5">
                        ${bodyHtml}
                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="${id}"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                            İptal
                        </button>
                        <button type="submit"
                            class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-colors disabled:opacity-60">
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(profile) {
    // Arama
    document.getElementById('search-input')?.addEventListener('input', e => {
        searchTerm = e.target.value;
        renderList(profile);
    });

    // Yeni müşteri butonu
    document.getElementById('btn-open-create')?.addEventListener('click', () => {
        document.getElementById('customer-modal-title').textContent = 'Yeni Müşteri';
        document.getElementById('customer-modal-body').innerHTML    = buildForm();
        document.getElementById('customer-modal-form').dataset.editId = '';
        openModal('customer-modal');
    });

    // Modal kapatma
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Tablo butonlari
    document.querySelector('tbody')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const id     = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'edit') {
            const customer = allCustomers.find(c => c.id === id);
            if (!customer) return;
            document.getElementById('customer-modal-title').textContent = 'Müşteri Duzenle';
            document.getElementById('customer-modal-body').innerHTML    = buildForm(customer);
            document.getElementById('customer-modal-form').dataset.editId = id;
            openModal('customer-modal');
        }

        if (action === 'delete') {
            const name = btn.dataset.name;
            if (!confirm(`"${name}" adli müşteri silinecek. Emin misiniz?`)) return;
            await deleteCustomer(id, profile);
        }
    });

    // Form gonder
    document.getElementById('customer-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveCustomer(e.target, profile);
    });
}

// ---------------------------------------------------
// CRUD - Kaydet (Olustur / Güncelle)
// ---------------------------------------------------

async function saveCustomer(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        first_name:        fd.get('first_name')?.trim() || null,
        last_name:         fd.get('last_name')?.trim()  || null,
        company_name:      fd.get('company_name')?.trim()     || null,
        tax_number:        fd.get('tax_number')?.trim()       || null,
        tax_office:        fd.get('tax_office')?.trim()       || null,
        phone:             fd.get('phone')?.trim()            || null,
        province:          fd.get('province')?.trim()         || null,
        district:          fd.get('district')?.trim()         || null,
        address:           fd.get('address')?.trim()          || null,
        authorized_person: fd.get('authorized_person')?.trim() || null,
        notes:             fd.get('notes')?.trim()            || null,
        is_active:         form.querySelector('[name="is_active"]')?.checked ?? true,
    };

    if (!payload.first_name || !payload.last_name || !payload.phone) {
        showToast('Ad, soyad ve telefon zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('customers').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            ({ error } = await supabase.from('customers').insert(payload));
        }

        if (error) throw error;

        showToast(editId ? 'Müşteri güncellendi.' : 'Müşteri olusturuldu.', 'success');
        closeModal('customer-modal');
        await renderCustomers({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}

// ---------------------------------------------------
// CRUD - Sil
// ---------------------------------------------------

async function deleteCustomer(id, profile) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
        showToast(translateError(error), 'error');
        return;
    }
    showToast('Müşteri silindi.', 'success');
    await renderCustomers({ profile });
}

// ---------------------------------------------------
// Filtreleme
// ---------------------------------------------------

function filterCustomers(list, term) {
    if (!term) return list;
    const q = term.toLowerCase();
    return list.filter(c =>
        (c.company_name  || '').toLowerCase().includes(q) ||
        (c.first_name    || '').toLowerCase().includes(q) ||
        (c.last_name     || '').toLowerCase().includes(q) ||
        (c.phone         || '').toLowerCase().includes(q)
    );
}
