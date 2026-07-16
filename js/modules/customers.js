import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate, formatDateTime,
    openModal, closeModal, buildOptions, translateError, setPageTitle,
    initSearchableSelect, showConfirmModal,
} from '../utils.js';

// ---------------------------------------------------
// Durum
// ---------------------------------------------------

let allCustomers = [];
let searchTerm   = '';

// Excel Aktarım Modülü Durum Değişkenleri
let excelWorkbook = null;
let excelSheets = [];
let selectedSheetData = null;
let excelHeaders = [];
let currentMapping = {};

const MAPPING_FIELDS = [
    { id: 'company_name', label: 'Firma Unvanı', required: false, desc: 'Müşterinin firma unvanı.' },
    { id: 'first_name', label: 'Ad', required: true, desc: 'Müşterinin adı (Zorunlu. Yoksa diğer alanlardan türetilir).' },
    { id: 'last_name', label: 'Soyad', required: true, desc: 'Müşterinin soyadı (Zorunlu. Yoksa diğer alanlardan türetilir).' },
    { id: 'phone', label: 'Telefon', required: false, desc: 'Müşterinin telefon numarası.' },
    { id: 'authorized_person', label: 'Yetkili Kişi', required: false, desc: 'Firma yetkilisinin adı soyadı.' },
    { id: 'tax_number', label: 'Vergi Numarası', required: false, desc: 'Vergi veya T.C. Kimlik numarası.' },
    { id: 'tax_office', label: 'Vergi Dairesi', required: false, desc: 'Bağlı olunan vergi dairesi.' },
    { id: 'province', label: 'İl', required: false, desc: 'Adres ili.' },
    { id: 'district', label: 'İlçe', required: false, desc: 'Adres ilçesi.' },
    { id: 'address', label: 'Adres', required: false, desc: 'Detaylı adres bilgisi.' },
    { id: 'notes', label: 'Özel Notlar', required: false, desc: 'Müşteri ile ilgili notlar.' },
    { id: 'license_program_name', label: 'Lisans Program Adı', required: false, desc: 'Örn: Wolvox ERP, Nebim V3' },
    { id: 'license_number', label: 'Lisans Anahtarı / Key', required: false, desc: 'Lisans seri numarası veya anahtarı.' },
    { id: 'license_version', label: 'Lisans Şifresi', required: false, desc: 'Program giriş şifresi veya lisans şifresi.' }
];

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

    const canWrite = ['Yönetici', 'Yonetici', 'Satış Personeli', 'Satis Personeli', 'Teknik Servis'].includes(profile?.role);
    const canDelete = ['Yönetici', 'Yonetici'].includes(profile?.role);

    const rows = filtered.length
        ? filtered.map(c => buildRow(c, canWrite, canDelete)).join('')
        : `<tr><td colspan="${8 + (canDelete ? 1 : 0)}" class="px-5 py-10 text-center text-sm text-gray-400">Kayıt bulunamadi.</td></tr>`;

    setContent(`
        <div class="max-w-7xl mx-auto">

            <!-- Başlık satiri -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Müşteriler</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${allCustomers.length} müşteri kaydi</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button
                        id="btn-open-import"
                        class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Excel'den Aktar
                    </button>
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
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-full">
                <div class="w-full overflow-x-hidden">
                    <table class="w-full text-sm text-left table-fixed">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="w-[22%] px-3 py-3 font-medium">Firma / Ad Soyad</th>
                                <th class="w-[12%] px-3 py-3 font-medium">Telefon</th>
                                <th class="w-[13%] px-3 py-3 font-medium">Il / Ilce</th>
                                <th class="w-[13%] px-3 py-3 font-medium">Yetkili</th>
                                <th class="w-[18%] px-3 py-3 font-medium">LİSANS BİLGİLERİ</th>
                                <th class="w-[9%] px-3 py-3 font-medium">Durum</th>
                                <th class="w-[10%] px-3 py-3 font-medium">Kayıt Tarihi</th>
                                ${canWrite ? `<th class="w-[10%] px-3 py-3 font-medium text-right">İşlemler</th>` : ''}
                                ${canDelete ? `<th class="w-[4%] px-2 py-3"></th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="customers-table-body" class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildModal('customer-modal', 'Yeni Müşteri', buildForm())}
        ${buildImportModal('import-modal', 'Excel\'den Müşteri İçe Aktar', buildImportWizardHtml())}
    `);

    bindEvents(profile);
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(c, canWrite, canDelete) {
    const name = c.company_name
        ? `<div class="font-medium text-gray-800 truncate" title="${escHtml(c.company_name)}">${escHtml(c.company_name)}</div>`
        : `<div class="font-medium text-gray-800 truncate" title="${escHtml(c.first_name)} ${escHtml(c.last_name)}">${escHtml(c.first_name)} ${escHtml(c.last_name)}</div>`;

    const sub = c.company_name
        ? `<span class="text-xs text-gray-400 block truncate" title="${escHtml(c.first_name)} ${escHtml(c.last_name)}">${escHtml(c.first_name)} ${escHtml(c.last_name)}</span>`
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
        </div>
    ` : '';

    const deleteColumn = canDelete ? `
        <td class="px-3 py-3 text-right w-12">
            <button
                data-action="delete"
                data-id="${c.id}"
                data-name="${escHtml(c.company_name || (c.first_name + ' ' + c.last_name))}"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center justify-center"
                data-tooltip="Müşteriyi Sil"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </td>
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
        <tr data-id="${c.id}" class="group hover:bg-slate-50 transition-colors cursor-pointer">
            <td class="px-3 py-3 overflow-hidden">
                ${name}
                ${sub}
            </td>
            <td class="px-3 py-3 text-gray-600 truncate" title="${escHtml(c.phone)}">${escHtml(c.phone)}</td>
            <td class="px-3 py-3 text-gray-600 truncate" title="${location}">${location}</td>
            <td class="px-3 py-3 text-gray-600 truncate" title="${escHtml(c.authorized_person) || '-'}">${escHtml(c.authorized_person) || '-'}</td>
            <td class="px-3 py-3 overflow-hidden">
                <div class="flex gap-1 items-center overflow-hidden whitespace-nowrap">
                    ${licensesList}
                </div>
            </td>
            <td class="px-3 py-3">
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusCls}">${statusTxt}</span>
            </td>
            <td class="px-3 py-3 text-gray-500 truncate" title="${formatDateTime(c.created_at)}">${formatDateTime(c.created_at)}</td>
            ${canWrite ? `<td class="px-3 py-3 text-right">${actions}</td>` : ''}
            ${deleteColumn}
        </tr>
    `;
}

// ---------------------------------------------------
// Form HTML
// ---------------------------------------------------

function buildLicenseBlock(lic = {}, index = 0, disabledAttr = '') {
    const programList = [
        'E-ÇÖZÜMLER',
        'E-OFİS',
        'WOLVOX ERP',
        'E-TİCARET',
        'WOLVOX GENEL MUHASEBE',
        'HOTELSMART',
        'MOBİL ÇÖZÜMLER',
        'OCTOCLOUD',
        'WOLVOX OTEL',
        'AKINSOFT OTEL',
        'WOLVOX RESTORAN',
        'WOLVOX SERVİS - SERİ LOT',
        'SİTECLOUD',
        'WOLVOX HIZLI SATIŞ',
        'WOLVOX CRM',
        'WOLVOX HRM',
        'WOLVOX MRP'
    ];
    const currentProg = lic.program_name || '';
    const options = programList.map(prog => `<option value="${prog}" ${currentProg === prog ? 'selected' : ''}>${prog}</option>`);
    if (currentProg && !programList.includes(currentProg)) {
        options.unshift(`<option value="${escHtml(currentProg)}" selected>${escHtml(currentProg)}</option>`);
    }

    return `
        <div class="license-block grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-slate-700" data-index="${index}">
            <input type="hidden" name="license_id_${index}" value="${lic.id || ''}">
            <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">${index + 1}. Program</label>
                <select name="license_program_name_${index}" ${disabledAttr}
                    class="license-program-select form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-gray-300">
                    <option value="">-- Seçiniz --</option>
                    ${options.join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Lisans Anahtarı / Key</label>
                <input type="text" name="license_number_${index}" value="${escHtml(lic.license_number || '')}" placeholder="Örn: LIC-12345-ABCD" ${disabledAttr}
                    class="license-key-input form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Şifre</label>
                <input type="text" name="license_version_${index}" value="${escHtml(lic.version || '')}" placeholder="Örn: 123456" ${disabledAttr}
                    class="license-password-input form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
        </div>
    `;
}

function buildForm(c = {}, isReadOnly = false) {
    const disabledAttr = isReadOnly ? 'disabled' : '';

    return `
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

            <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adres</label>
                <textarea name="address" rows="2" ${disabledAttr}
                    class="form-input w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(c.address)}</textarea>
            </div>

            <!-- Lisans Bilgileri Bölümü -->
            <div class="sm:col-span-2 mt-2 pt-4 border-t border-gray-100 dark:border-slate-700">
                <h4 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
                    </svg>
                    Lisans Bilgileri
                </h4>
                <div id="licenses-container" class="space-y-3">
                    ${(() => {
                        const licenses = [...(c.licenses || [])];
                        if (licenses.length === 0 || licenses[licenses.length - 1].program_name) {
                            licenses.push({});
                        }
                        return licenses.map((lic, index) => buildLicenseBlock(lic, index, disabledAttr)).join('');
                    })()}
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
    document.getElementById('customers-table-body')?.addEventListener('click', async e => {
        const target = e.target;

        // Buton veya popover tetikleyicisi kontrolü
        const button = target.closest('button');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            if (action === 'delete') {
                console.log('Silme tetiklendi, ID:', id);
                e.stopPropagation();
                const name = button.dataset.name;
                const confirmed = await showConfirmModal({
                    title: 'Müşteriyi Sil',
                    message: `"${name}" adlı müşteri kaydı kalıcı olarak silinecektir. Bu işlemi onaylıyor musunuz?`,
                    confirmText: 'Evet, Sil',
                    cancelText: 'Vazgeç'
                });
                if (confirmed) {
                    const tr = button.closest('tr');
                    if (tr) {
                        tr.style.transition = 'all 0.3s ease';
                        tr.style.opacity = '0';
                        tr.style.transform = 'translateX(20px)';
                    }
                    
                    try {
                        const { error } = await supabase.from('customers').delete().eq('id', id);
                        if (error) {
                            console.error('Supabase Müşteri Silme Hatası:', error);
                            
                            let errorMsg = translateError(error);
                            if (error.code === '23503') errorMsg = 'Bu müşteri başka verilere (Görev, Ziyaret vb.) bağlı olduğu için silinemez (Yabancı Anahtar Hatası).';
                            else if (error.code === '42501') errorMsg = 'Bu işlemi yapmaya yetkiniz yok (Yönetici yetkisi gerektirir).';
                            
                            showToast(errorMsg, 'error');
                            if (tr) {
                                tr.style.opacity = '';
                                tr.style.transform = '';
                            }
                            return;
                        }
                        showToast('Müşteri silindi.', 'success');
                    } catch (err) {
                        console.error('Müşteri silme sırasında istisna:', err);
                        showToast('Beklenmeyen bir hata oluştu.', 'error');
                        if (tr) {
                            tr.style.opacity = '';
                            tr.style.transform = '';
                        }
                        return;
                    }
                    allCustomers = allCustomers.filter(c => c.id !== id);
                    setTimeout(() => {
                        renderList(profile);
                    }, 300);
                }
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

    // Dinamik Program Ekleme / Temizleme
    document.addEventListener('change', e => {
        const target = e.target;
        if (!target.classList.contains('license-program-select')) return;

        const container = document.getElementById('licenses-container');
        if (!container) return;

        const blocks = container.querySelectorAll('.license-block');
        const totalBlocks = blocks.length;

        const changedBlock = target.closest('.license-block');
        const changedIndex = parseInt(changedBlock.dataset.index);

        // Eğer sonuncu blokta seçim yapıldıysa, yeni bir satır ekle
        if (changedIndex === totalBlocks - 1 && target.value) {
            const nextIndex = totalBlocks;
            const newBlockHtml = buildLicenseBlock({}, nextIndex, '');
            container.insertAdjacentHTML('beforeend', newBlockHtml);
            const newSelect = container.querySelector(`[name="license_program_name_${nextIndex}"]`);
            if (newSelect) {
                initSearchableSelect(newSelect);
            }
        }

        // Fazla boş blokları temizleme
        const currentBlocks = container.querySelectorAll('.license-block');
        for (let i = currentBlocks.length - 1; i > 0; i--) {
            const block = currentBlocks[i];
            const selectVal = block.querySelector('.license-program-select')?.value;
            const keyVal = block.querySelector('.license-key-input')?.value;
            const passVal = block.querySelector('.license-password-input')?.value;
            const isBlockEmpty = !selectVal && !keyVal && !passVal;

            const prevBlock = currentBlocks[i - 1];
            const prevSelectVal = prevBlock.querySelector('.license-program-select')?.value;
            const prevKeyVal = prevBlock.querySelector('.license-key-input')?.value;
            const prevPassVal = prevBlock.querySelector('.license-password-input')?.value;
            const isPrevBlockEmpty = !prevSelectVal && !prevKeyVal && !prevPassVal;

            if (isBlockEmpty && isPrevBlockEmpty) {
                block.remove();
            }
        }

        // Dinamik yeniden indeksleme ve etiket güncelleme
        const remainingBlocks = container.querySelectorAll('.license-block');
        remainingBlocks.forEach((block, idx) => {
            block.dataset.index = idx;
            const label = block.querySelector('label');
            if (label) {
                label.textContent = `${idx + 1}. Program`;
            }
            const hiddenId = block.querySelector('input[type="hidden"]');
            if (hiddenId) hiddenId.name = `license_id_${idx}`;
            const progSel = block.querySelector('.license-program-select');
            if (progSel) progSel.name = `license_program_name_${idx}`;
            const keyInput = block.querySelector('.license-key-input');
            if (keyInput) keyInput.name = `license_number_${idx}`;
            const passInput = block.querySelector('.license-password-input');
            if (passInput) passInput.name = `license_version_${idx}`;
        });
    });

    bindImportEvents(profile);
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

    const licenseIndices = [];
    for (const key of fd.keys()) {
        if (key.startsWith('license_program_name_')) {
            const idx = key.replace('license_program_name_', '');
            licenseIndices.push(parseInt(idx));
        }
    }

    const uniqueLicenseNumbers = new Set();
    for (const idx of licenseIndices) {
        const prog = fd.get(`license_program_name_${idx}`)?.trim();
        const num = fd.get(`license_number_${idx}`)?.trim();
        if ((prog && !num) || (!prog && num)) {
            showToast(`${idx + 1}. Program için hem Program Seçmeli hem de Lisans Anahtarı girmelisiniz.`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }
        if (num) {
            if (uniqueLicenseNumbers.has(num)) {
                showToast(`"${num}" lisans anahtarını birden fazla program için kullanamazsınız.`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
            uniqueLicenseNumbers.add(num);
        }
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

        // Her bir lisans kaydı için işlem yap
        const userId = (await supabase.auth.getUser()).data.user?.id;
        for (const idx of licenseIndices) {
            const licId = fd.get(`license_id_${idx}`);
            const prog = fd.get(`license_program_name_${idx}`)?.trim();
            const num = fd.get(`license_number_${idx}`)?.trim();
            const ver = fd.get(`license_version_${idx}`)?.trim();

            if (licId && !prog && !num) {
                // Lisans silinmiş
                const { error: delErr } = await supabase.from('licenses').delete().eq('id', licId);
                if (delErr) throw delErr;
            } else if (prog && num) {
                const licensePayload = {
                    customer_id: customerId,
                    program_name: prog,
                    license_number: num,
                    version: ver || null,
                };

                let licErr;
                if (licId) {
                    ({ error: licErr } = await supabase.from('licenses').update(licensePayload).eq('id', licId));
                } else {
                    licensePayload.created_by = userId;
                    ({ error: licErr } = await supabase.from('licenses').insert(licensePayload));
                }
                if (licErr) throw licErr;
            }
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

// ---------------------------------------------------
// Excel İçe Aktarma Modülü Yardımcı & İş Mantığı Fonksiyonları
// ---------------------------------------------------

function buildImportModal(id, title, bodyHtml) {
    return `
        <div
            id="${id}"
            class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true"
        >
            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto border border-gray-100 dark:border-slate-800">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                    <h3 id="${id}-title" class="text-lg font-semibold text-gray-800 dark:text-gray-100">${title}</h3>
                    <button data-close-modal="${id}" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="${id}-body" class="px-6 py-5">
                    ${bodyHtml}
                </div>
            </div>
        </div>
    `;
}

function buildImportWizardHtml() {
    return `
        <div id="import-wizard-container" class="space-y-4">
            <!-- Adım Göstergesi -->
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-slate-850 pb-3">
                <div class="flex items-center gap-2">
                    <span id="step-badge" class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                    <h4 id="step-title" class="font-bold text-gray-850 dark:text-gray-200">Dosya Seçin</h4>
                </div>
                <span id="step-indicator-text" class="text-xs text-gray-450 dark:text-gray-400 font-medium">Adım 1 / 4</span>
            </div>

            <!-- Adım 1: Dosya Sürükle Bırak -->
            <div id="import-step-1" class="step-content">
                <label for="excel-file-input" class="excel-upload-zone flex flex-col items-center justify-center p-10 border-dashed text-center">
                    <svg class="w-12 h-12 text-emerald-500 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                    </svg>
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Excel dosyasını sürükleyin veya göz atın</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500 mt-1">Desteklenen formatlar: .xlsx, .xls, .csv</span>
                    <input type="file" id="excel-file-input" class="hidden" accept=".xlsx, .xls, .csv">
                </label>
            </div>

            <!-- Adım 2: Sütun Eşleştirme -->
            <div id="import-step-2" class="step-content hidden space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-500 dark:text-gray-450 mb-1">Çalışma Sayfası (Sheet)</label>
                    <select id="excel-sheet-select" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-slate-900"></select>
                </div>
                <div class="max-h-[300px] overflow-y-auto border border-gray-150 dark:border-slate-800 rounded-xl">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 sticky top-0">
                            <tr>
                                <th class="px-4 py-2 font-semibold">TeknikCRM Alanı</th>
                                <th class="px-4 py-2 font-semibold">Excel Sütun Başlığı</th>
                            </tr>
                        </thead>
                        <tbody id="mapping-fields-body" class="divide-y divide-gray-50 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            <!-- JS ile üretilecek -->
                        </tbody>
                    </table>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                    <button type="button" id="btn-import-prev-1" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">Geri</button>
                    <button type="button" id="btn-import-next-2" class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Önizle</button>
                </div>
            </div>

            <!-- Adım 3: Önizleme & Validasyon -->
            <div id="import-step-3" class="step-content hidden space-y-4">
                <div class="text-xs text-gray-500 dark:text-gray-400">
                    Aşağıda eşleştirdiğiniz alanlara göre ilk 5 satır gösterilmektedir. Lütfen kontrol edin.
                </div>
                <div class="overflow-x-auto border border-gray-100 dark:border-slate-800 rounded-xl max-h-[250px]">
                    <table class="w-full text-xs text-left">
                        <thead class="text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800" id="preview-table-head">
                            <!-- JS ile üretilecek -->
                        </thead>
                        <tbody id="preview-table-body" class="divide-y divide-gray-50 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            <!-- JS ile üretilecek -->
                        </tbody>
                    </table>
                </div>
                <div id="validation-errors" class="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-lg text-xs leading-relaxed hidden"></div>
                <div class="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                    <button type="button" id="btn-import-prev-2" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">Geri</button>
                    <button type="button" id="btn-import-start" class="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Aktarımı Başlat</button>
                </div>
            </div>

            <!-- Adım 4: İlerleme & Raporlama -->
            <div id="import-step-4" class="step-content hidden space-y-4">
                <div class="text-center py-4">
                    <div id="import-progress-area" class="space-y-2">
                        <div class="flex justify-between text-sm font-semibold text-gray-700 dark:text-gray-350">
                            <span id="import-progress-status">Müşteriler aktarılıyor...</span>
                            <span id="import-progress-percent">0%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div id="import-progress-fill" class="progress-bar-fill"></div>
                        </div>
                    </div>
                    
                    <div id="import-result-summary" class="hidden space-y-3">
                        <svg class="w-12 h-12 text-emerald-500 mx-auto" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <h5 class="text-base font-bold text-gray-800 dark:text-gray-200">Aktarım Tamamlandı</h5>
                        <p id="import-result-text" class="text-sm text-gray-500 dark:text-gray-400"></p>
                        
                        <div id="import-failed-rows-container" class="mt-4 text-left hidden space-y-1">
                            <p class="text-xs font-bold text-red-650 dark:text-red-400">Başarısız / Atlanan Kayıtlar:</p>
                            <div id="import-failed-rows" class="max-h-[120px] overflow-y-auto p-2.5 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/30 rounded-lg text-[11px] font-mono whitespace-pre-line">
                            </div>
                        </div>
                        
                        <button type="button" id="btn-import-close" class="mt-6 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none">Tamam</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindImportEvents(profile) {
    const btnOpenImport = document.getElementById('btn-open-import');
    const importModal = document.getElementById('import-modal');
    const fileInput = document.getElementById('excel-file-input');
    const uploadZone = document.querySelector('.excel-upload-zone');
    const sheetSelect = document.getElementById('excel-sheet-select');
    
    btnOpenImport?.addEventListener('click', () => {
        resetImportWizard();
        openModal('import-modal');
    });

    importModal?.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal('import-modal'));
    });
    
    document.getElementById('btn-import-close')?.addEventListener('click', async () => {
        closeModal('import-modal');
        await renderCustomers({ profile });
    });

    if (uploadZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
            }, false);
        });

        uploadZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                if (fileInput) fileInput.files = files;
                handleFileSelection(files[0]);
            }
        });
    }

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    sheetSelect?.addEventListener('change', (e) => {
        loadSheetData(e.target.value);
    });

    document.getElementById('btn-import-prev-1')?.addEventListener('click', () => {
        showImportStep(1);
    });
    
    document.getElementById('btn-import-prev-2')?.addEventListener('click', () => {
        showImportStep(2);
    });

    document.getElementById('btn-import-next-2')?.addEventListener('click', () => {
        saveMappingAndShowPreview();
    });

    document.getElementById('btn-import-start')?.addEventListener('click', async () => {
        await startImport(profile);
    });
}

function resetImportWizard() {
    excelWorkbook = null;
    excelSheets = [];
    selectedSheetData = null;
    excelHeaders = [];
    currentMapping = {};
    
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';
    
    showImportStep(1);
    
    const progressFill = document.getElementById('import-progress-fill');
    if (progressFill) progressFill.style.width = '0%';
    const progressPercent = document.getElementById('import-progress-percent');
    if (progressPercent) progressPercent.textContent = '0%';
    const progressStatus = document.getElementById('import-progress-status');
    if (progressStatus) progressStatus.textContent = 'Veriler aktarılıyor...';
    
    document.getElementById('import-progress-area')?.classList.remove('hidden');
    document.getElementById('import-result-summary')?.classList.add('hidden');
    document.getElementById('import-failed-rows-container')?.classList.add('hidden');
    
    const failedRowsList = document.getElementById('import-failed-rows');
    if (failedRowsList) failedRowsList.innerHTML = '';
}

function showImportStep(stepNum) {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`import-step-${i}`);
        if (el) {
            if (i === stepNum) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    }
    
    const stepBadge = document.getElementById('step-badge');
    const stepTitle = document.getElementById('step-title');
    const stepText = document.getElementById('step-indicator-text');
    
    if (stepBadge) stepBadge.textContent = stepNum;
    if (stepText) stepText.textContent = `Adım ${stepNum} / 4`;
    
    if (stepTitle) {
        if (stepNum === 1) stepTitle.textContent = 'Dosya Seçin';
        else if (stepNum === 2) stepTitle.textContent = 'Sütunları Eşleştirin';
        else if (stepNum === 3) stepTitle.textContent = 'Önizleme & Doğrulama';
        else if (stepNum === 4) stepTitle.textContent = 'Aktarım Durumu';
    }
}

function handleFileSelection(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            excelWorkbook = workbook;
            excelSheets = workbook.SheetNames;
            
            if (excelSheets.length === 0) {
                showToast('Excel dosyasında çalışma sayfası bulunamadı.', 'error');
                return;
            }
            
            const sheetSelect = document.getElementById('excel-sheet-select');
            if (sheetSelect) {
                sheetSelect.innerHTML = excelSheets.map(name => `<option value="${escHtml(name)}">${escHtml(name)}</option>`).join('');
            }
            
            loadSheetData(excelSheets[0]);
        } catch (err) {
            console.error(err);
            showToast('Excel dosyası okunurken hata oluştu: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function loadSheetData(sheetName) {
    if (!excelWorkbook) return;
    
    try {
        const worksheet = excelWorkbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (rawRows.length === 0) {
            showToast('Çalışma sayfası boş.', 'warning');
            return;
        }
        
        let headerRowIndex = 0;
        while (headerRowIndex < rawRows.length && rawRows[headerRowIndex].filter(v => String(v).trim() !== "").length === 0) {
            headerRowIndex++;
        }
        
        if (headerRowIndex >= rawRows.length) {
            showToast('Tabloda veri satırı bulunamadı.', 'warning');
            return;
        }
        
        excelHeaders = rawRows[headerRowIndex].map(h => String(h).trim()).filter(Boolean);
        selectedSheetData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        renderColumnMapping();
        showImportStep(2);
    } catch (err) {
        console.error(err);
        showToast('Sayfa verisi yüklenirken hata oluştu: ' + err.message, 'error');
    }
}

function renderColumnMapping() {
    const tbody = document.getElementById('mapping-fields-body');
    if (!tbody) return;
    
    const autoGuesses = autoDetectMapping(excelHeaders);
    currentMapping = autoGuesses;
    
    const fieldsHtml = MAPPING_FIELDS.map(f => {
        const requiredBadge = f.required ? '<span class="text-red-500 font-bold">*</span>' : '';
        const mappedHeader = currentMapping[f.id] || '';
        
        const optionsHtml = ['<option value="">-- Eşleştirme Yok --</option>']
            .concat(excelHeaders.map(h => {
                const selected = h === mappedHeader ? 'selected' : '';
                return `<option value="${escHtml(h)}" ${selected}>${escHtml(h)}</option>`;
            })).join('');
            
        return `
            <tr>
                <td class="px-4 py-2.5">
                    <div class="font-medium text-gray-700 dark:text-gray-300 text-xs">${escHtml(f.label)} ${requiredBadge}</div>
                    <div class="text-[10px] text-gray-400 dark:text-gray-500 font-normal">${escHtml(f.desc)}</div>
                </td>
                <td class="px-4 py-2.5">
                    <select data-field="${escHtml(f.id)}" class="mapping-select w-full px-2 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 dark:text-gray-350">
                        ${optionsHtml}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = fieldsHtml;
}

function autoDetectMapping(headers) {
    const mapping = {};
    const guessRules = {
        company_name: ['firma', 'unvan', 'şirket', 'company', 'cari', 'adı', 'adi', 'firma unvani', 'cari adi'],
        first_name: ['ad', 'isim', 'first_name', 'first name', 'adi'],
        last_name: ['soyad', 'soyisim', 'last_name', 'last name', 'soyadi'],
        authorized_person: ['yetkili', 'kişi', 'kisi', 'authorized', 'ilgili', 'yetkili kisi'],
        phone: ['tel', 'telefon', 'phone', 'gsm', 'cep', 'telefonu', 'tel no'],
        tax_number: ['vergi no', 'vergi dairesi no', 'vno', 'vergi numarası', 'tax', 'tax number', 'vergi_no', 'tc', 'tc kimlik'],
        tax_office: ['vergi dairesi', 'vd', 'vergi_dairesi', 'tax office', 'vergi dairesi adi'],
        province: ['il', 'şehir', 'sehir', 'city', 'province'],
        district: ['ilçe', 'ilce', 'district', 'town'],
        address: ['adres', 'address', 'fatura adresi', 'cari adresi'],
        notes: ['not', 'açıklama', 'aciklama', 'notes', 'description', 'notlar'],
        license_program_name: ['program', 'yazılım', 'lisans programı', 'program_adi'],
        license_number: ['lisans', 'key', 'anahtar', 'lisans anahtarı', 'license', 'lisans_no'],
        license_version: ['şifre', 'sifre', 'şifresi', 'sifresi', 'password', 'pass', 'versiyon', 'sürüm', 'version', 'program_surum']
    };

    for (const [field, keywords] of Object.entries(guessRules)) {
        let found = headers.find(h => keywords.includes(h.toLowerCase().trim()));
        if (!found) {
            found = headers.find(h => keywords.some(k => h.toLowerCase().includes(k)));
        }
        if (found) {
            mapping[field] = found;
        }
    }
    return mapping;
}

function saveMappingAndShowPreview() {
    const selects = document.querySelectorAll('#mapping-fields-body select');
    const mapping = {};
    
    selects.forEach(sel => {
        const field = sel.dataset.field;
        const excelCol = sel.value;
        if (excelCol) {
            mapping[field] = excelCol;
        }
    });
    
    currentMapping = mapping;
    

    if (!mapping.first_name && !mapping.company_name && !mapping.authorized_person) {
        showToast('İsim tespiti yapabilmek için "Ad", "Firma Unvanı" veya "Yetkili Kişi" alanlarından en az birini eşleştirmelisiniz.', 'warning');
        return;
    }
    
    const previewHead = document.getElementById('preview-table-head');
    const previewBody = document.getElementById('preview-table-body');
    const validationErrors = document.getElementById('validation-errors');
    
    if (!previewHead || !previewBody) return;
    
    const mappedFieldIds = Object.keys(mapping);
    
    previewHead.innerHTML = `
        <tr>
            ${mappedFieldIds.map(fid => {
                const f = MAPPING_FIELDS.find(field => field.id === fid);
                return `<th class="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">${escHtml(f.label)}</th>`;
            }).join('')}
        </tr>
    `;
    
    const previewRows = selectedSheetData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(row => {
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                ${mappedFieldIds.map(fid => {
                    const excelCol = mapping[fid];
                    const rawVal = row[excelCol];
                    let displayVal = rawVal !== undefined ? rawVal : '';
                    
                    return `<td class="px-4 py-2 text-gray-750 dark:text-gray-350">${escHtml(String(displayVal))}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
    
    let warnings = [];
    if (!mapping.first_name || !mapping.last_name) {
        warnings.push('⚠️ <strong>Not:</strong> "Ad" veya "Soyad" sütunlarından biri eşleştirilmemiş. Ad/soyad bilgisi; Yetkili Kişi veya Firma Unvanı alanlarından otomatik çıkarılacaktır.');
    }
    if (mapping.license_number && !mapping.license_program_name) {
        warnings.push('⚠️ <strong>Dikkat:</strong> Lisans Anahtarı eşleştirildi fakat Lisans Program Adı eşleştirilmedi. Lisans kayıtları atlanacaktır.');
    }
    
    if (warnings.length > 0 && validationErrors) {
        validationErrors.innerHTML = warnings.join('<br>');
        validationErrors.classList.remove('hidden');
    } else if (validationErrors) {
        validationErrors.classList.add('hidden');
    }
    
    showImportStep(3);
}

async function startImport(profile) {
    showImportStep(4);
    
    const progressFill = document.getElementById('import-progress-fill');
    const progressPercent = document.getElementById('import-progress-percent');
    const progressStatus = document.getElementById('import-progress-status');
    const resultSummary = document.getElementById('import-result-summary');
    const progressArea = document.getElementById('import-progress-area');
    
    const totalRows = selectedSheetData.length;
    let successCount = 0;
    let failCount = 0;
    const failedRows = [];
    
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    for (let i = 0; i < totalRows; i++) {
        const row = selectedSheetData[i];
        
        const percent = Math.round((i / totalRows) * 100);
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressStatus) progressStatus.textContent = `${i + 1} / ${totalRows} satır işleniyor...`;
        
        const getMappedVal = (fid) => {
            const col = currentMapping[fid];
            if (!col) return null;
            const val = row[col];
            return val !== undefined && val !== null ? String(val).trim() : null;
        };
        
        const phoneRaw = getMappedVal('phone');
        const phone = cleanPhone(phoneRaw) || '-';
        
        const firstRaw = getMappedVal('first_name');
        const lastRaw = getMappedVal('last_name');
        const company = getMappedVal('company_name');
        const authorized = getMappedVal('authorized_person');
        
        const nameObj = cleanName(firstRaw, lastRaw, company, authorized);
        
        const customerPayload = {
            first_name: nameObj.first,
            last_name: nameObj.last,
            company_name: company || null,
            tax_number: getMappedVal('tax_number') || null,
            tax_office: getMappedVal('tax_office') || null,
            phone: phone,
            province: getMappedVal('province') || null,
            district: getMappedVal('district') || null,
            address: getMappedVal('address') || null,
            authorized_person: authorized || null,
            notes: getMappedVal('notes') || null,
            is_active: true,
            created_by: userId
        };
        
        try {
            const { data: custData, error: custErr } = await supabase
                .from('customers')
                .insert(customerPayload)
                .select('id');
                
            if (custErr) throw custErr;
            
            const customerId = custData[0]?.id;
            
            const licProgram = getMappedVal('license_program_name');
            const licNumber = getMappedVal('license_number');
            const licVersion = getMappedVal('license_version');
            
            if (customerId && licProgram && licNumber) {
                const licensePayload = {
                    customer_id: customerId,
                    program_name: licProgram,
                    license_number: licNumber,
                    version: licVersion || null,
                    created_by: userId
                };
                
                const { error: licErr } = await supabase
                    .from('licenses')
                    .insert(licensePayload);
                    
                if (licErr) {
                    console.error('License insertion error:', licErr);
                }
            }
            
            successCount++;
        } catch (err) {
            console.error('Row insert error:', err);
            failCount++;
            failedRows.push({ rowNum: i + 2, reason: err.message || String(err) });
        }
    }
    
    if (progressFill) progressFill.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';
    
    if (progressArea) progressArea.classList.add('hidden');
    if (resultSummary) resultSummary.classList.remove('hidden');
    
    const resultText = document.getElementById('import-result-text');
    if (resultText) {
        resultText.textContent = `${successCount} müşteri başarıyla aktarıldı. ${failCount} kayıt başarısız oldu.`;
    }
    
    const failedContainer = document.getElementById('import-failed-rows-container');
    const failedList = document.getElementById('import-failed-rows');
    
    if (failCount > 0 && failedContainer && failedList) {
        failedContainer.classList.remove('hidden');
        failedList.textContent = failedRows.map(f => `Satır ${f.rowNum}: ${f.reason}`).join('\n');
    }
}

function parseExcelDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    const dmy = str.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = str.match(/^(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})$/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed)) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return null;
}

function cleanName(first, last, company, authorized) {
    let f = (first || '').trim();
    let l = (last || '').trim();
    
    if (f && l) return { first: f, last: l };
    
    if (f && !l) {
        const parts = f.split(/\s+/);
        if (parts.length > 1) {
            l = parts.pop();
            f = parts.join(' ');
            return { first: f, last: l };
        } else {
            return { first: f, last: '.' };
        }
    }
    
    if (authorized && authorized.trim()) {
        const parts = authorized.trim().split(/\s+/);
        if (parts.length > 1) {
            l = parts.pop();
            f = parts.join(' ');
            return { first: f, last: l };
        } else {
            return { first: parts[0], last: '.' };
        }
    }
    
    if (company && company.trim()) {
        const parts = company.trim().split(/\s+/);
        if (parts.length > 1) {
            l = parts.pop();
            f = parts.join(' ');
            return { first: f, last: l };
        } else {
            return { first: parts[0], last: '.' };
        }
    }
    
    return { first: 'Müşteri', last: '-' };
}

function cleanPhone(phoneVal) {
    if (!phoneVal) return '';
    return String(phoneVal).replace(/[^0-9+]/g, '');
}

