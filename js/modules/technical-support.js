import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDateTime, formatPrice,
    statusBadge, openModal, closeModal, buildOptions, translateError, setPageTitle,
    showConfirmModal,
} from '../utils.js';
import { buildSupportDetailModal, showSupportDetail } from './details.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderTechnicalSupport({ profile }) {
    console.log('Aktif Rol:', profile?.role);
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

    const canWrite = ['Yönetici', 'Yonetici', 'Teknik Servis'].includes(profile?.role);
    const canDelete = ['Yönetici', 'Yonetici'].includes(profile?.role);

    setContent(buildHTML(supports, customers, staff, canWrite, canDelete, profile));
    bindEvents(profile, customers, staff, supports);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(supports, customers, staff, canWrite, canDelete, profile) {
    const rows = supports.length
        ? supports.map(s => buildRow(s, canWrite, canDelete, profile)).join('')
        : `<tr><td colspan="${9 + (canWrite ? 1 : 0) + (canDelete ? 1 : 0)}" class="px-5 py-10 text-center text-sm text-gray-400">Destek kaydi bulunamadi.</td></tr>`;

    const custOptions  = buildOptions(customers, 'id', c => c.company_name || `${c.first_name} ${c.last_name}`);
    const staffOptions = buildOptions(staff, 'id', s => s.full_name);

    return `
        <div class="max-w-7xl mx-auto">

            <!-- Başlık + Yeni Destek butonu -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Teknik Destek</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${supports.length} kayıt listeleniyor</p>
                </div>
                <button
                    id="btn-new-support"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Yeni Destek
                </button>
            </div>

            <!-- Durum filtresi -->
            <div class="flex flex-wrap gap-2 mb-4">
                <button data-filter-status="" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 bg-gray-100">Tümü</button>
                <button data-filter-status="Acik" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50">Acik</button>
                <button data-filter-status="Devam Ediyor" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-orange-200 text-orange-700 hover:bg-orange-50">Devam Ediyor</button>
                <button data-filter-status="Cozuldu" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-green-200 text-green-700 hover:bg-green-50">Çözüldü</button>
                <button data-filter-status="Kapali" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50">Kapali</button>
            </div>

            <!-- Tablo -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-full">
                <div class="w-full overflow-x-hidden">
                    <table class="w-full text-sm text-left table-fixed">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="w-20 px-2 py-3 font-medium">No</th>
                                <th class="px-2 py-3 font-medium">Müşteri</th>
                                <th class="px-2 py-3 font-medium">Konu</th>
                                <th class="w-28 px-2 py-3 font-medium">Arayan</th>
                                <th class="w-28 px-2 py-3 font-medium">Atanan</th>
                                <th class="w-36 px-2 py-3 font-medium">Başlangıç</th>
                                <th class="w-24 px-2 py-3 font-medium">Fiyat</th>
                                <th class="w-24 px-2 py-3 font-medium">Ödeme</th>
                                <th class="w-28 px-2 py-3 font-medium">Durum</th>
                                ${canWrite ? `<th class="w-36 px-2 py-3 font-medium text-right">İşlemler</th>` : ''}
                                ${canDelete ? `<th class="w-12 px-2 py-3"></th>` : ''}
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
        ${buildSupportDetailModal()}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(s, canWrite, canDelete, profile) {
    const customer = s.customers
        ? escHtml(s.customers.company_name || `${s.customers.first_name} ${s.customers.last_name}`)
        : '-';
    const assignee = s.assigned?.full_name ? escHtml(s.assigned.full_name) : '-';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2 whitespace-nowrap">
            <button data-action="detail" data-id="${s.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">Detay</button>
            <button data-action="edit" data-id="${s.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50 whitespace-nowrap">Duzenle</button>
        </div>` : `
        <div class="flex items-center justify-end whitespace-nowrap">
            <button data-action="detail" data-id="${s.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">Detay</button>
        </div>`;

    // Fiyat sütunu
    const priceCell = s.servis_tipi === 'Ucretli'
        ? `<span class="text-sm font-semibold text-gray-700 whitespace-nowrap">${formatPrice(s.fiyat)}</span>`
        : `<span class="badge-service-free whitespace-nowrap">Ücretsiz</span>`;

    // Ödeme durumu sütunu
    const paymentCell = s.servis_tipi === 'Ucretli'
        ? (s.odeme_durumu === 'Odendi'
            ? `<span class="badge-fee-paid whitespace-nowrap">Ödendi</span>`
            : `<span class="badge-fee-unpaid whitespace-nowrap">Ödenmedi</span>`)
        : `<span class="text-gray-300 text-sm select-none whitespace-nowrap">—</span>`;

    const deleteColumn = canDelete ? `
        <td class="px-2 py-3 text-right w-12">
            <button
                data-action="delete"
                data-id="${s.id}"
                data-no="${s.support_number}"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center justify-center"
                data-tooltip="Destek Kaydını Sil"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </td>
    ` : '';

    return `
        <tr class="group cursor-pointer hover:bg-slate-50 transition-colors" data-status="${escHtml(s.status)}" data-id="${s.id}">
            <td class="px-2 py-3 truncate">
                <span class="support-number-badge text-indigo-700 whitespace-nowrap">#${s.support_number}</span>
            </td>
            <td class="px-2 py-3 font-medium text-gray-800 truncate" title="${customer}">${customer}</td>
            <td class="px-2 py-3 text-gray-700 truncate" title="${escHtml(s.subject)}">${escHtml(s.subject)}</td>
            <td class="px-2 py-3 text-gray-600 truncate" title="${escHtml(s.caller_name)}">${escHtml(s.caller_name)}</td>
            <td class="px-2 py-3 text-gray-600 truncate" title="${assignee}">${assignee}</td>
            <td class="px-2 py-3 text-gray-500 text-xs truncate" title="${formatDateTime(s.start_time)}">${formatDateTime(s.start_time)}</td>
            <td class="px-2 py-3 whitespace-nowrap">${priceCell}</td>
            <td class="px-2 py-3 whitespace-nowrap">${paymentCell}</td>
            <td class="px-2 py-3 whitespace-nowrap">${statusBadge(s.status)}</td>
            ${canWrite ? `<td class="px-2 py-3 whitespace-nowrap text-right">${actions}</td>` : ''}
            ${deleteColumn}
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
                            <label class="block text-sm font-medium text-gray-700 mb-1">Müşteri <span class="text-red-500">*</span></label>
                            <select name="customer_id" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Müşteri secin --</option>
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
                            <label class="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
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
                                <option value="Acik">Açık</option>
                                <option value="Devam Ediyor">Devam Ediyor</option>
                                <option value="Cozuldu">Çözüldü</option>
                                <option value="Kapali">Kapalı</option>
                            </select>
                        </div>

                        <!-- Servis Tipi -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Servis Tipi</label>
                            <select name="servis_tipi"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Ucretsiz">Ücretsiz</option>
                                <option value="Ucretli">Ücretli</option>
                            </select>
                        </div>

                        <!-- Dinamik Ücret Alanları (Sadece Ücretli seçildiğinde görünür) -->
                        <div id="fee-dynamic-wrapper" class="sm:col-span-2 fee-dynamic-fields">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Fiyat (₺)</label>
                                    <input type="number" name="fiyat" step="0.01" min="0" placeholder="0,00"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Ödeme Durumu</label>
                                    <select name="odeme_durumu"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="Odenmedi">Ödenmedi</option>
                                        <option value="Odendi">Ödendi</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Çözüm Detayi</label>
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

function bindEvents(profile, customers, staff, supports) {
    document.getElementById('btn-new-support')?.addEventListener('click', () => {
        document.getElementById('support-modal-title').textContent = 'Yeni Destek Kaydi';
        document.getElementById('support-modal-form').dataset.editId = '';
        document.getElementById('support-modal-form').reset();
        toggleFeeFields(); // Formu sıfırladığında alanları gizle
        openModal('support-modal');
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Servis Tipi değişim dinleyicisi
    const servisTipiSelect = document.querySelector('#support-modal-form [name="servis_tipi"]');
    if (servisTipiSelect) {
        servisTipiSelect.addEventListener('change', () => toggleFeeFields());
    }

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
        if (btn) {
            const id     = btn.dataset.id;
            const action = btn.dataset.action;
            const support = supports.find(s => s.id === id);
            if (!support) return;

            if (action === 'detail') {
                await showSupportDetail(support, profile);
            }

            if (action === 'edit') {
                document.getElementById('support-modal-title').textContent = 'Destek Güncelle';
                fillSupportForm(document.getElementById('support-modal-form'), support);
                document.getElementById('support-modal-form').dataset.editId = id;
                openModal('support-modal');
            }

            if (action === 'delete') {
                console.log('Silme tetiklendi, ID:', id);
                e.stopPropagation();
                const confirmed = await showConfirmModal({
                    title: 'Destek Kaydını Sil',
                    message: `#${btn.dataset.no} numaralı teknik destek kaydı kalıcı olarak silinecektir. Bu işlemi onaylıyor musunuz?`,
                    confirmText: 'Evet, Sil',
                    cancelText: 'Vazgeç'
                });
                if (confirmed) {
                    const tr = btn.closest('tr');
                    if (tr) {
                        tr.style.transition = 'all 0.3s ease';
                        tr.style.opacity = '0';
                        tr.style.transform = 'translateX(20px)';
                    }
                    try {
                        const { error } = await supabase.from('technical_supports').delete().eq('id', id);
                        if (error) {
                            console.error('Supabase Silme Hatası:', error);
                            
                            let errorMsg = translateError(error);
                            if (error.code === '23503') errorMsg = 'Bu kayıt başka verilerle ilişkili olduğu için silinemez (Yabancı Anahtar Hatası).';
                            else if (error.code === '42501') errorMsg = 'Bu işlemi yapmaya yetkiniz yok (Yönetici yetkisi gerektirir).';
                            
                            showToast(errorMsg, 'error');
                            if (tr) {
                                tr.style.opacity = '';
                                tr.style.transform = '';
                            }
                            return;
                        }
                        showToast('Destek kaydı başarıyla silindi.', 'success');
                    } catch (err) {
                        console.error('Silme işlemi sırasında beklenmeyen hata (İstisna):', err);
                        showToast('Beklenmeyen bir hata oluştu.', 'error');
                        if (tr) {
                            tr.style.opacity = '';
                            tr.style.transform = '';
                        }
                        return;
                    }
                    
                    const idx = supports.findIndex(s => s.id === id);
                    if (idx !== -1) supports.splice(idx, 1);
                    
                    setTimeout(() => {
                        const canWrite = ['Yönetici', 'Yonetici', 'Teknik Servis'].includes(profile?.role);
                        const canDelete = ['Yönetici', 'Yonetici'].includes(profile?.role);
                        setContent(buildHTML(supports, customers, staff, canWrite, canDelete, profile));
                        bindEvents(profile, customers, staff, supports);
                    }, 300);
                }
            }
            return;
        }

        const row = e.target.closest('tr[data-id]');
        if (row) {
            const id = row.dataset.id;
            const support = supports.find(s => s.id === id);
            if (support) {
                await showSupportDetail(support, profile);
            }
        }
    });

    // Form gonder
    document.getElementById('support-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveSupport(e.target, profile);
    });
}


// ---------------------------------------------------
// Dinamik alan göster/gizle
// ---------------------------------------------------

function toggleFeeFields() {
    const form = document.getElementById('support-modal-form');
    if (!form) return;
    const servisTipi = form.querySelector('[name="servis_tipi"]')?.value;
    const wrapper = document.getElementById('fee-dynamic-wrapper');
    if (!wrapper) return;

    if (servisTipi === 'Ucretli') {
        wrapper.classList.add('is-visible');
    } else {
        wrapper.classList.remove('is-visible');
        // Ücretsiz seçildiğinde alanları temizle
        const fiyatInput = form.querySelector('[name="fiyat"]');
        const odemeSelect = form.querySelector('[name="odeme_durumu"]');
        if (fiyatInput) fiyatInput.value = '';
        if (odemeSelect) odemeSelect.value = 'Odenmedi';
    }
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

    // Finansal alanlar
    form.querySelector('[name="servis_tipi"]').value  = s.servis_tipi  || 'Ucretsiz';
    form.querySelector('[name="fiyat"]').value        = s.fiyat != null ? s.fiyat : '';
    form.querySelector('[name="odeme_durumu"]').value = s.odeme_durumu || 'Odenmedi';

    // Dinamik alanları duruma göre göster/gizle
    toggleFeeFields();
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

    const servisTipi = fd.get('servis_tipi') || 'Ucretsiz';
    const isUcretli  = servisTipi === 'Ucretli';

    const payload = {
        customer_id:   fd.get('customer_id')        || null,
        caller_name:   fd.get('caller_name')?.trim() || null,
        caller_phone:  fd.get('caller_phone')?.trim() || null,
        subject:       fd.get('subject')?.trim()     || null,
        description:   fd.get('description')?.trim() || null,
        assigned_to:   fd.get('assigned_to')         || null,
        status:        fd.get('status')              || 'Acik',
        resolution:    fd.get('resolution')?.trim()  || null,
        notes:         fd.get('notes')?.trim()        || null,
        servis_tipi:   servisTipi,
        fiyat:         isUcretli ? (parseFloat(fd.get('fiyat')) || null) : null,
        odeme_durumu:  isUcretli ? (fd.get('odeme_durumu') || 'Odenmedi') : null,
    };

    if (!payload.customer_id || !payload.caller_name || !payload.subject) {
        showToast('Müşteri, arayan kisi ve konu zorunludur.', 'error');
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
        showToast(editId ? 'Destek güncellendi.' : 'Destek kaydi olusturuldu.', 'success');
        closeModal('support-modal');
        await renderTechnicalSupport({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
