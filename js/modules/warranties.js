import { supabase } from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    openModal, closeModal, buildOptions, translateError,
    setPageTitle, showConfirmModal
} from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderWarranties({ profile }) {
    setPageTitle('Garanti Takip');

    const [warrantiesRes, customersRes] = await Promise.all([
        supabase
            .from('warranties')
            .select('*, customers(id, company_name, first_name, last_name)')
            .order('created_at', { ascending: false }),
        supabase.from('customers').select('id, first_name, last_name, company_name').eq('is_active', true).order('company_name'),
    ]);

    if (warrantiesRes.error) {
        showToast('Garanti kayıtlari yuklenemedi: ' + warrantiesRes.error.message, 'error');
        return;
    }

    const warranties = warrantiesRes.data || [];
    const customers  = customersRes.data  || [];

    const canWrite  = ['Yönetici', 'Yonetici', 'Teknik Servis'].includes(profile?.role);
    const canDelete = ['Yönetici', 'Yonetici'].includes(profile?.role);

    setContent(buildHTML(warranties, customers, canWrite, canDelete, profile));
    bindEvents(profile, customers, warranties);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(warranties, customers, canWrite, canDelete, profile) {
    const rows = warranties.length
        ? warranties.map(w => buildRow(w, canWrite, canDelete, profile)).join('')
        : `<tr><td colspan="${7 + (canWrite ? 1 : 0) + (canDelete ? 1 : 0)}" class="px-5 py-10 text-center text-sm text-gray-400">Garanti kaydı bulunamadı.</td></tr>`;

    const custOptions = buildOptions(customers, 'id', c => c.company_name || `${c.first_name} ${c.last_name}`);

    return `
        <div class="max-w-7xl mx-auto">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Garanti Takip</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${warranties.length} adet kayıt</p>
                </div>
                ${canWrite ? `
                <button id="btn-open-create"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Yeni Kayıt
                </button>` : ''}
            </div>

            <!-- Durum filtresi -->
            <div class="flex flex-wrap gap-2 mb-4">
                <button data-filter="" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 bg-gray-100 ring-2 ring-indigo-300">Tümü</button>
                <button data-filter="Gönderilecek" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-yellow-200 text-yellow-700 hover:bg-yellow-50">Gönderilecek</button>
                <button data-filter="Gönderildi" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50">Gönderildi</button>
                <button data-filter="Tamamlandı" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-green-200 text-green-700 hover:bg-green-50">Tamamlandı</button>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-full">
                <div class="w-full overflow-x-hidden">
                    <table class="w-full text-sm text-left table-fixed">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="w-[15%] px-2.5 py-3 font-medium">Tarih</th>
                                <th class="w-[18%] px-2.5 py-3 font-medium">Müşteri</th>
                                <th class="w-[12%] px-2.5 py-3 font-medium">Ürün Türü</th>
                                <th class="w-[15%] px-2.5 py-3 font-medium">Marka / Model</th>
                                <th class="w-[15%] px-2.5 py-3 font-medium">Seri No</th>
                                <th class="w-[12%] px-2.5 py-3 font-medium">Durum</th>
                                <th class="w-[13%] px-2.5 py-3 font-medium">Not</th>
                                ${canWrite ? `<th class="w-[10%] px-2.5 py-3 font-medium text-right">İşlemler</th>` : ''}
                                ${canDelete ? `<th class="w-[4%] px-2 py-3"></th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="warranties-table-body" class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        ${buildModal(custOptions)}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(w, canWrite, canDelete, profile) {
    const customer = w.customers
        ? escHtml(w.customers.company_name || `${w.customers.first_name} ${w.customers.last_name}`)
        : '-';

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button data-action="edit" data-id="${w.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Düzenle</button>
        </div>` : '';

    const deleteColumn = canDelete ? `
        <td class="px-2 py-3 text-right w-12">
            <button
                data-action="delete"
                data-id="${w.id}"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 inline-flex items-center justify-center"
                title="Sil"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </td>
    ` : '';

    let desc = w.description ? escHtml(w.description) : '-';
    if (desc.length > 20) {
        desc = desc.substring(0, 20) + '...';
    }

    let statusColor = 'gray';
    if (w.status === 'Gönderilecek') statusColor = 'yellow';
    else if (w.status === 'Gönderildi') statusColor = 'blue';
    else if (w.status === 'Tamamlandı') statusColor = 'green';

    const brandModel = `${w.brand || '-'} / ${w.model || '-'}`;

    return `
        <tr class="group hover:bg-slate-50 transition-colors" data-status="${escHtml(w.status)}" data-id="${w.id}">
            <td class="px-2.5 py-3 text-gray-600">${formatDate(w.created_at)}</td>
            <td class="px-2.5 py-3 font-medium text-gray-800 truncate" title="${customer}">${customer}</td>
            <td class="px-2.5 py-3 text-gray-600 truncate uppercase text-xs" title="${escHtml(w.product_type)}">${escHtml(w.product_type)}</td>
            <td class="px-2.5 py-3 text-gray-600 truncate" title="${escHtml(brandModel)}">${escHtml(brandModel)}</td>
            <td class="px-2.5 py-3 text-gray-600 truncate font-mono text-xs" title="${escHtml(w.serial_number || '-')}">${escHtml(w.serial_number || '-')}</td>
            <td class="px-2.5 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800">
                    ${escHtml(w.status)}
                </span>
            </td>
            <td class="px-2.5 py-3 text-gray-500 text-xs truncate" title="${w.description ? escHtml(w.description) : ''}">${desc}</td>
            ${canWrite ? `<td class="px-2.5 py-3 text-right">${actions}</td>` : ''}
            ${deleteColumn}
        </tr>
    `;
}

// ---------------------------------------------------
// Modal
// ---------------------------------------------------

function buildModal(custOptions) {
    return `
        <div id="warranty-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="warranty-modal-title" class="text-lg font-semibold text-gray-800">Yeni Garanti Kaydı</h3>
                    <button data-close-modal="warranty-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="warranty-modal-form" novalidate>
                    <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Müşteri</label>
                            <select name="customer_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Secin --</option>
                                ${custOptions}
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ürün Türü <span class="text-red-500">*</span></label>
                            <select name="product_type" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="pos">POS</option>
                                <option value="yazıcı">Yazıcı</option>
                                <option value="dokunmatik pc">Dokunmatik PC</option>
                                <option value="kasa">Kasa</option>
                                <option value="barkod okuyucu">Barkod Okuyucu</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Seri Numarası <span class="text-red-500">*</span></label>
                            <input type="text" name="serial_number" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Marka</label>
                            <input type="text" name="brand" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                            <input type="text" name="model" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Gönderilecek">Gönderilecek</option>
                                <option value="Gönderildi">Gönderildi</option>
                                <option value="Tamamlandı">Tamamlandı</option>
                            </select>
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Açıklama / Not</label>
                            <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="warranty-modal" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
                        <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-60">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(profile, customers, warranties) {
    document.getElementById('btn-open-create')?.addEventListener('click', () => {
        document.getElementById('warranty-modal-title').textContent = 'Yeni Garanti Kaydı';
        document.getElementById('warranty-modal-form').dataset.editId = '';
        document.getElementById('warranty-modal-form').reset();
        openModal('warranty-modal');
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

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

    document.getElementById('warranties-table-body')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
            const id     = btn.dataset.id;
            const action = btn.dataset.action;
            const warranty = warranties.find(w => w.id === id);

            if (action === 'edit' && warranty) {
                document.getElementById('warranty-modal-title').textContent = 'Kayıt Düzenle';
                document.getElementById('warranty-modal-form').dataset.editId = id;
                fillForm(document.getElementById('warranty-modal-form'), warranty);
                openModal('warranty-modal');
            }

            if (action === 'delete') {
                const confirmed = await showConfirmModal({
                    title: 'Kaydı Sil',
                    message: `Bu garanti kaydı kalıcı olarak silinecektir. Onaylıyor musunuz?`,
                    confirmText: 'Evet, Sil',
                    cancelText: 'Vazgeç'
                });
                if (confirmed) {
                    const tr = btn.closest('tr');
                    if (tr) {
                        tr.style.opacity = '0.5';
                    }
                    try {
                        const { error } = await supabase.from('warranties').delete().eq('id', id);
                        if (error) {
                            showToast(translateError(error), 'error');
                            if (tr) tr.style.opacity = '1';
                            return;
                        }
                        showToast('Kayıt silindi.', 'success');
                        await renderWarranties({ profile });
                    } catch (err) {
                        showToast('Hata oluştu.', 'error');
                        if (tr) tr.style.opacity = '1';
                    }
                }
            }
        }
    });

    document.getElementById('warranty-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveWarranty(e.target, profile);
    });
}

function fillForm(form, w) {
    form.querySelector('[name="customer_id"]').value   = w.customer_id || '';
    form.querySelector('[name="product_type"]').value  = w.product_type || 'pos';
    form.querySelector('[name="serial_number"]').value = w.serial_number || '';
    form.querySelector('[name="brand"]').value         = w.brand || '';
    form.querySelector('[name="model"]').value         = w.model || '';
    form.querySelector('[name="status"]').value        = w.status || 'Gönderilecek';
    form.querySelector('[name="description"]').value   = w.description || '';
}

async function saveWarranty(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        customer_id:   fd.get('customer_id') || null,
        product_type:  fd.get('product_type'),
        serial_number: fd.get('serial_number')?.trim() || null,
        brand:         fd.get('brand')?.trim() || null,
        model:         fd.get('model')?.trim() || null,
        status:        fd.get('status') || 'Gönderilecek',
        description:   fd.get('description')?.trim() || null,
    };

    if (!payload.serial_number || !payload.product_type) {
        showToast('Ürün türü ve seri numarası zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('warranties').update(payload).eq('id', editId));
        } else {
            payload.created_by = profile.id;
            ({ error } = await supabase.from('warranties').insert(payload));
        }
        
        if (error) throw error;
        
        showToast(editId ? 'Kayıt güncellendi.' : 'Kayıt oluşturuldu.', 'success');
        closeModal('warranty-modal');
        await renderWarranties({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
