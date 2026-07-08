import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate, formatDateTime,
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
    console.log('Aktif Rol:', profile?.role);
    setPageTitle('Müşteriler');

    const { data, error } = await supabase
        .from('customers')
        .select('*, licenses(*)')
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
    // Varsa eski popover'ı kapat
    const existing = document.getElementById('active-license-popover');
    if (existing) {
        existing.remove();
    }

    const filtered = filterCustomers(allCustomers, searchTerm);

    const canWrite = ['Yönetici', 'Satış Personeli', 'Teknik Servis'].includes(profile?.role);
    const canDelete = profile?.role === 'Yönetici';

    const rows = filtered.length
        ? filtered.map(c => buildRow(c, canWrite, canDelete)).join('')
        : `<tr><td colspan="8" class="px-5 py-10 text-center text-sm text-gray-400">Kayıt bulunamadi.</td></tr>`;

    setContent(`
        <div class="max-w-7xl mx-auto">

            <!-- Başlık satiri -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Müşteriler</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${allCustomers.length} müşteri kaydi</p>
                </div>
                <button
                    id="btn-open-create"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Yeni Müşteri
                </button>
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
                                <th class="px-5 py-3 font-medium">LİSANS BİLGİLERİ</th>
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

    const licensesList = c.licenses && c.licenses.length > 0
        ? c.licenses.map(lic => {
            return `
                <button 
                    type="button"
                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded border border-indigo-100 hover:border-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    onclick="window.showLicensePopover(event, '${escHtml(lic.license_number)}', '${escHtml(lic.program_name)}')"
                    title="${escHtml(lic.program_name)}"
                >
                    <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
                    </svg>
                    <span class="truncate max-w-[80px]">${escHtml(lic.program_name)}</span>
                </button>
            `;
          }).join('')
        : `<span class="text-gray-400 font-normal text-xs">-</span>`;

    return `
        <tr data-id="${c.id}" class="hover:bg-slate-50 transition-colors cursor-pointer">
            <td class="px-5 py-3">
                <div class="font-medium text-gray-800">${name}</div>
                ${sub}
            </td>
            <td class="px-5 py-3 text-gray-600">${escHtml(c.phone)}</td>
            <td class="px-5 py-3 text-gray-600">${location}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(c.authorized_person) || '-'}</td>
            <td class="px-5 py-3">
                <div class="flex flex-wrap gap-1 items-center">
                    ${licensesList}
                </div>
            </td>
            <td class="px-5 py-3">
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusCls}">${statusTxt}</span>
            </td>
            <td class="px-5 py-3 text-gray-500">${formatDateTime(c.created_at)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Form HTML
// ---------------------------------------------------

function buildForm(c = {}, isReadOnly = false) {
    const lic = c.licenses && c.licenses[0] ? c.licenses[0] : {};
    const disabledAttr = isReadOnly ? 'disabled' : '';

    return `
        <!-- Gizli alanlar -->
        <input type="hidden" name="license_id" value="${lic.id || ''}">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ad <span class="text-red-500">*</span></label>
                <input type="text" name="first_name" value="${escHtml(c.first_name)}" required ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Soyad <span class="text-red-500">*</span></label>
                <input type="text" name="last_name" value="${escHtml(c.last_name)}" required ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Firma Unvani</label>
                <input type="text" name="company_name" value="${escHtml(c.company_name)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vergi No</label>
                <input type="text" name="tax_number" value="${escHtml(c.tax_number)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vergi Dairesi</label>
                <input type="text" name="tax_office" value="${escHtml(c.tax_office)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefon <span class="text-red-500">*</span></label>
                <input type="tel" name="phone" value="${escHtml(c.phone)}" required ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yetkili Kisi</label>
                <input type="text" name="authorized_person" value="${escHtml(c.authorized_person)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Il</label>
                <input type="text" name="province" value="${escHtml(c.province)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ilce</label>
                <input type="text" name="district" value="${escHtml(c.district)}" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adres</label>
                <textarea name="address" rows="2" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(c.address)}</textarea>
            </div>

            <!-- Lisans Bilgileri Bölümü -->
            <div class="sm:col-span-2 mt-2 pt-4 border-t border-gray-100 dark:border-slate-700">
                <h4 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
                    </svg>
                    Lisans Bilgileri
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Program Adı</label>
                        <input type="text" name="license_program_name" value="${escHtml(lic.program_name)}" placeholder="Örn: Nebim V3" ${disabledAttr}
                            class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Lisans Anahtarı / Key</label>
                        <input type="text" name="license_number" value="${escHtml(lic.license_number)}" placeholder="Örn: LIC-12345-ABCD" ${disabledAttr}
                            class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Versiyon</label>
                        <input type="text" name="license_version" value="${escHtml(lic.version)}" placeholder="Örn: 24.2.1" ${disabledAttr}
                            class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Bakım Bitiş Tarihi</label>
                        <input type="date" name="license_maintenance_end" value="${lic.maintenance_end || ''}" ${disabledAttr}
                            class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                </div>
            </div>

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ozel Notlar</label>
                <textarea name="notes" rows="2" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(c.notes)}</textarea>
            </div>

            <div class="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is-active-check" name="is_active" ${c.is_active !== false ? 'checked' : ''} ${disabledAttr}
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <label for="is-active-check" class="text-sm font-medium text-gray-700 dark:text-gray-300">Aktif müşteri</label>
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
// Müşteri Detay / Düzenleme Modalini Açma Yardımcısı
// ---------------------------------------------------

function openCustomerDetailsModal(customer, profile) {
    const isReadOnly = !['Yönetici', 'Yonetici'].includes(profile?.role);

    const titleEl = document.getElementById('customer-modal-title');
    if (titleEl) {
        titleEl.textContent = isReadOnly ? 'Müşteri Detay Bilgisi' : 'Müşteri Bilgileri & Düzenleme';
    }

    const bodyEl = document.getElementById('customer-modal-body');
    if (bodyEl) {
        bodyEl.innerHTML = buildForm(customer, isReadOnly);
    }

    const formEl = document.getElementById('customer-modal-form');
    if (formEl) {
        formEl.dataset.editId = customer.id;
    }

    const submitBtn = formEl?.querySelector('[type="submit"]');
    if (submitBtn) {
        if (isReadOnly) {
            submitBtn.classList.add('hidden');
        } else {
            submitBtn.classList.remove('hidden');
            submitBtn.textContent = 'Değişiklikleri Kaydet';
        }
    }

    openModal('customer-modal');
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
        document.getElementById('customer-modal-body').innerHTML    = buildForm({}, false);
        const form = document.getElementById('customer-modal-form');
        if (form) {
            form.dataset.editId = '';
            const submitBtn = form.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.remove('hidden');
                submitBtn.textContent = 'Kaydet';
            }
        }
        openModal('customer-modal');
    });

    // Modal kapatma
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Tablo satırlarına ve butonlarına tıklama olayı
    document.querySelector('tbody')?.addEventListener('click', async e => {
        const target = e.target;

        // Buton veya popover tetikleyicisi kontrolü
        const button = target.closest('button');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            if (action === 'delete') {
                e.stopPropagation();
                const name = button.dataset.name;
                if (!confirm(`"${name}" adli müşteri silinecek. Emin misiniz?`)) return;
                await deleteCustomer(id, profile);
            } else if (action === 'edit') {
                e.stopPropagation();
                const customer = allCustomers.find(c => c.id === id);
                if (customer) openCustomerDetailsModal(customer, profile);
            }
            return;
        }

        // Genel satır tıklama (satırın kendisi)
        const tr = target.closest('tr');
        if (tr) {
            const id = tr.dataset.id;
            const customer = allCustomers.find(c => c.id === id);
            if (customer) openCustomerDetailsModal(customer, profile);
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
    const originalText = submitBtn.textContent;
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
        submitBtn.textContent = originalText;
        return;
    }

    const programName = fd.get('license_program_name')?.trim();
    const licenseNumber = fd.get('license_number')?.trim();
    const licenseVersion = fd.get('license_version')?.trim();
    const licenseEnd = fd.get('license_maintenance_end') || null;

    if ((programName && !licenseNumber) || (!programName && licenseNumber)) {
        showToast('Lisans kaydetmek için hem Program Adı hem de Lisans Anahtarı alanlarını doldurmalısınız.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }

    try {
        let error;
        let customerId = editId;

        if (editId) {
            ({ error } = await supabase.from('customers').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            const { data, error: insertErr } = await supabase.from('customers').insert(payload).select('id');
            error = insertErr;
            if (data && data.length > 0) {
                customerId = data[0].id;
            }
        }

        if (error) throw error;

        // Lisans kaydetme/güncelleme/silme adımı
        const licenseId = fd.get('license_id');
        if (licenseId && !programName && !licenseNumber) {
            const { error: delErr } = await supabase.from('licenses').delete().eq('id', licenseId);
            if (delErr) throw delErr;
        } else if (programName && licenseNumber) {
            const licensePayload = {
                customer_id: customerId,
                program_name: programName,
                license_number: licenseNumber,
                version: licenseVersion || null,
                maintenance_end: licenseEnd || null,
            };

            let licErr;
            if (licenseId) {
                ({ error: licErr } = await supabase.from('licenses').update(licensePayload).eq('id', licenseId));
            } else {
                licensePayload.created_by = (await supabase.auth.getUser()).data.user?.id;
                ({ error: licErr } = await supabase.from('licenses').insert(licensePayload));
            }
            if (licErr) throw licErr;
        }

        showToast(editId ? 'Müşteri bilgileri güncellendi.' : 'Müşteri ve lisans bilgileri oluşturuldu.', 'success');
        closeModal('customer-modal');
        await renderCustomers({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
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

// ---------------------------------------------------
// Lisans Popover & Kopyalama Yardımcıları
// ---------------------------------------------------

window.showLicensePopover = function(event, licenseNumber, programName) {
    event.stopPropagation();
    
    // Varsa eski popover'ı kapat
    const existing = document.getElementById('active-license-popover');
    if (existing) {
        existing.remove();
    }
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    const popover = document.createElement('div');
    popover.id = 'active-license-popover';
    popover.className = 'fixed bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-gray-200/80 dark:border-slate-700/80 rounded-2xl shadow-xl p-3.5 z-[100] text-left w-72 transition-all duration-200 opacity-0 transform translate-y-1';
    
    popover.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-2">
            <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
                ${escHtml(programName)} Lisans Anahtarı
            </span>
            <button 
                type="button"
                class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" 
                onclick="window.copyLicenseKey(event, '${escHtml(licenseNumber)}', this)"
                title="Panoya Kopyala"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2 2 0 002-2V6a2 2 0 00-2-2h-2.25m-1.5 14H9.75a2 2 0 01-2-2V9a2 2 0 012-2h4.5a2 2 0 012 2v5.25a2 2 0 01-2 2z"/>
                </svg>
            </button>
        </div>
        <div class="relative flex items-center justify-between gap-2 bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800/80 rounded-xl p-2.5 font-mono text-[11px] text-gray-800 dark:text-gray-200 break-all select-all">
            <span class="pr-2 select-all">${escHtml(licenseNumber)}</span>
        </div>
    `;
    
    document.body.appendChild(popover);
    
    // Pozisyon hesaplama
    const popoverHeight = popover.offsetHeight || 90;
    const popoverWidth = 288;
    
    let top = rect.top + window.scrollY - popoverHeight - 10;
    let left = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);
    
    // Ekran dışına taşmayı önle
    if (left < 10) left = 10;
    if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
    }
    if (top < 10) {
        top = rect.bottom + window.scrollY + 10;
    }
    
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    
    // Giriş animasyonu
    requestAnimationFrame(() => {
        popover.classList.remove('opacity-0', 'translate-y-1');
        popover.classList.add('opacity-100', 'translate-y-0');
    });
    
    // Dışarı tıklanınca kapatma olayı
    const closeListener = (e) => {
        if (!popover.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            popover.classList.remove('opacity-100', 'translate-y-0');
            popover.classList.add('opacity-0', 'translate-y-1');
            setTimeout(() => popover.remove(), 200);
            document.removeEventListener('click', closeListener);
        }
    };
    
    document.addEventListener('click', closeListener);
};

window.copyLicenseKey = function(event, key, button) {
    event.stopPropagation();
    navigator.clipboard.writeText(key).then(() => {
        const originalIcon = button.innerHTML;
        button.innerHTML = `
            <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
        `;
        button.classList.add('text-green-500');
        showToast('Lisans anahtarı panoya kopyalandı.', 'success');
        
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.classList.remove('text-green-500');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Kopyalama başarısız oldu.', 'error');
    });
};
