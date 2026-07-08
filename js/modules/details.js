import { supabase } from '../supabase-config.js';
import {
    escHtml, formatDate, formatDateTime,
    statusBadge, priorityBadge, openModal, closeModal,
    showToast, translateError, getServiceBadgeHTML, formatPrice, buildOptions
} from '../utils.js';

// ---------------------------------------------------
// Görev Detay Modali
// ---------------------------------------------------

export function buildTaskDetailModal() {
    return `
        <div id="task-detail-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800">Görev Detayi</h3>
                    <button data-close-modal="task-detail-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div id="task-detail-modal-body" class="px-6 py-5 space-y-4 text-sm">
                    <!-- Dinamik icerik -->
                </div>
                <div class="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button type="button" data-close-modal="task-detail-modal"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Kapat</button>
                </div>
            </div>
        </div>
    `;
}

export function showTaskDetail(t) {
    const customer = t.customers
        ? (t.customers.company_name || `${t.customers.first_name} ${t.customers.last_name}`)
        : '-';
    const assignee = t.assigned?.full_name ? t.assigned.full_name : '-';

    document.getElementById('task-detail-modal-body').innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <span class="text-gray-400 text-xs">Müşteri</span>
                <p class="font-medium text-gray-800">${escHtml(customer)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Atanan Personel</span>
                <p class="font-medium text-gray-800">${escHtml(assignee)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Öncelik</span>
                <div class="mt-1">${priorityBadge(t.priority)}</div>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Durum</span>
                <div class="mt-1">${statusBadge(t.status)}</div>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Başlangıç Tarihi</span>
                <p class="font-medium text-gray-800">${formatDate(t.start_date)} ${t.start_time ? `(${t.start_time.slice(0, 5)})` : ''}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Bitiş Tarihi</span>
                <p class="font-medium text-gray-800">${formatDate(t.end_date)} ${t.end_time ? `(${t.end_time.slice(0, 5)})` : ''}</p>
            </div>
        </div>
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Başlık</span>
            <p class="font-semibold text-gray-800 text-base mt-0.5">${escHtml(t.title)}</p>
        </div>
        ${t.description ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Açıklama</span>
            <p class="text-gray-700 mt-1 whitespace-pre-wrap">${escHtml(t.description)}</p>
        </div>` : ''}
    `;
    openModal('task-detail-modal');
}

// ---------------------------------------------------
// Ziyaret Detay Modali
// ---------------------------------------------------

export function buildVisitDetailModal() {
    return `
        <div id="visit-detail-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800">Ziyaret Detayi</h3>
                    <button data-close-modal="visit-detail-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div id="visit-detail-modal-body" class="px-6 py-5 space-y-4 text-sm">
                    <!-- Dinamik icerik -->
                </div>
                <div class="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button type="button" data-close-modal="visit-detail-modal"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Kapat</button>
                </div>
            </div>
        </div>
    `;
}

export function showVisitDetail(v) {
    const customer = v.customers
        ? (v.customers.company_name || `${v.customers.first_name} ${v.customers.last_name}`)
        : '-';
    const assignee = v.assigned?.full_name ? v.assigned.full_name : '-';
    const timeStr = v.visit_time ? v.visit_time.slice(0, 5) : '';

    document.getElementById('visit-detail-modal-body').innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div>
                <span class="text-gray-400 text-xs">Müşteri</span>
                <p class="font-medium text-gray-800">${escHtml(customer)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Atanan Personel</span>
                <p class="font-medium text-gray-800">${escHtml(assignee)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Ziyaret Tarihi</span>
                <p class="font-medium text-gray-800">${formatDate(v.visit_date)} ${timeStr ? `(${timeStr})` : ''}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Durum</span>
                <div class="mt-1">${statusBadge(v.status)}</div>
            </div>
            <div class="col-span-2">
                <span class="text-gray-400 text-xs">Adres</span>
                <p class="font-medium text-gray-800">${escHtml(v.address || '-')}</p>
            </div>
        </div>
        ${v.purpose ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Ziyaret Amaci</span>
            <p class="text-gray-700 mt-1">${escHtml(v.purpose)}</p>
        </div>` : ''}
        ${v.notes ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Ziyaret Notlari</span>
            <p class="text-gray-700 mt-1 whitespace-pre-wrap">${escHtml(v.notes)}</p>
        </div>` : ''}
        ${v.work_done ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Yapilan Is</span>
            <p class="text-gray-700 mt-1 whitespace-pre-wrap">${escHtml(v.work_done)}</p>
        </div>` : ''}
        ${v.result ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Sonuc</span>
            <p class="text-gray-700 mt-1 whitespace-pre-wrap">${escHtml(v.result)}</p>
        </div>` : ''}
    `;
    openModal('visit-detail-modal');
}

// ---------------------------------------------------
// Teknik Destek Detay Modali
// ---------------------------------------------------

export function buildSupportDetailModal() {
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
                <div id="detail-modal-body" class="px-6 py-5 space-y-4 text-sm">
                    <!-- Dinamik icerik -->
                </div>
                <div id="detail-modal-footer" class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <!-- Dinamik butonlar -->
                </div>
            </div>
        </div>
    `;
}

export async function showSupportDetail(s, profile) {
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

    const canLog = ['Yönetici', 'Teknik Servis'].includes(profile?.role);
    const isAdmin = ['Yönetici', 'Yonetici'].includes(profile?.role);

    document.getElementById('detail-modal-title').textContent = `Destek #${s.support_number}`;

    if (isAdmin) {
        // Aktif personelleri dropdown listesi için yükle
        const { data: staffData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('is_active', true)
            .order('full_name');
        
        const staffOptions = buildOptions(staffData || [], 'id', staff => staff.full_name, s.assigned_to);

        document.getElementById('detail-modal-body').innerHTML = `
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <span class="text-gray-400 text-xs">Müşteri</span>
                    <p class="font-medium text-gray-800 py-2">${escHtml(customer)}</p>
                </div>
                <div>
                    <span class="text-gray-400 text-xs">Durum</span>
                    <select id="detail-status" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="Acik" ${s.status === 'Acik' ? 'selected' : ''}>Açık</option>
                        <option value="Devam Ediyor" ${s.status === 'Devam Ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                        <option value="Cozuldu" ${s.status === 'Cozuldu' ? 'selected' : ''}>Çözüldü</option>
                        <option value="Kapali" ${s.status === 'Kapali' ? 'selected' : ''}>Kapalı</option>
                    </select>
                </div>
                <div>
                    <span class="text-gray-400 text-xs">Arayan Kişi</span>
                    <input type="text" id="detail-caller-name" value="${escHtml(s.caller_name || '')}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
                <div>
                    <span class="text-gray-400 text-xs">Arayan Telefon</span>
                    <input type="text" id="detail-caller-phone" value="${escHtml(s.caller_phone || '')}"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
                <div>
                    <span class="text-gray-400 text-xs">Başlangıç</span>
                    <p class="font-medium text-gray-800 py-2">${formatDateTime(s.start_time)}</p>
                </div>
                <div>
                    <span class="text-gray-400 text-xs">Atanan Personel</span>
                    <select id="detail-assigned-to" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Seçin --</option>
                        ${staffOptions}
                    </select>
                </div>
                <div class="col-span-2">
                    <span class="text-gray-400 text-xs">Servis Tipi</span>
                    <select id="detail-servis-tipi" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="Ucretsiz" ${s.servis_tipi === 'Ucretsiz' ? 'selected' : ''}>Ücretsiz</option>
                        <option value="Ucretli" ${s.servis_tipi === 'Ucretli' ? 'selected' : ''}>Ücretli</option>
                    </select>
                </div>
            </div>
            <div id="detail-fee-wrapper" class="fee-dynamic-fields ${s.servis_tipi === 'Ucretli' ? 'is-visible' : ''}">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <span class="text-gray-400 text-xs">Fiyat (₺)</span>
                        <input type="number" id="detail-fiyat" step="0.01" min="0" placeholder="0,00" value="${s.fiyat != null ? s.fiyat : ''}"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <span class="text-gray-400 text-xs">Ödeme Durumu</span>
                        <select id="detail-odeme-durumu" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="Odenmedi" ${s.odeme_durumu !== 'Odendi' ? 'selected' : ''}>Ödenmedi</option>
                            <option value="Odendi" ${s.odeme_durumu === 'Odendi' ? 'selected' : ''}>Ödendi</option>
                        </select>
                    </div>
                </div>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Konu</span>
                <input type="text" id="detail-subject" value="${escHtml(s.subject || '')}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div>
                <span class="text-gray-400 text-xs">Açıklama</span>
                <textarea id="detail-description" rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(s.description || '')}</textarea>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Çözüm Detayı</span>
                <textarea id="detail-resolution" rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(s.resolution || '')}</textarea>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Notlar</span>
                <textarea id="detail-notes" rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none">${escHtml(s.notes || '')}</textarea>
            </div>
            <div>
                <p class="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Log Kayıtları</p>
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

        document.getElementById('detail-modal-footer').innerHTML = `
            <button type="button" data-close-modal="support-detail-modal"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">İptal</button>
            <button id="btn-save-detail-changes" type="button"
                class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300">
                Değişiklikleri Kaydet
            </button>
        `;

        // Servis tipi degisim dinleyicisi
        const detailServisTipi = document.getElementById('detail-servis-tipi');
        const detailFeeWrapper = document.getElementById('detail-fee-wrapper');
        if (detailServisTipi && detailFeeWrapper) {
            detailServisTipi.addEventListener('change', () => {
                if (detailServisTipi.value === 'Ucretli') {
                    detailFeeWrapper.classList.add('is-visible');
                } else {
                    detailFeeWrapper.classList.remove('is-visible');
                    const f = document.getElementById('detail-fiyat');
                    const o = document.getElementById('detail-odeme-durumu');
                    if (f) f.value = '';
                    if (o) o.value = 'Odenmedi';
                }
            });
        }

        // Kaydet butonu dinleyicisi
        const saveChangesBtn = document.getElementById('btn-save-detail-changes');
        if (saveChangesBtn) {
            saveChangesBtn.onclick = async () => {
                saveChangesBtn.disabled = true;
                saveChangesBtn.textContent = 'Kaydediliyor...';

                const status = document.getElementById('detail-status').value;
                const caller_name = document.getElementById('detail-caller-name').value.trim() || null;
                const caller_phone = document.getElementById('detail-caller-phone').value.trim() || null;
                const assigned_to = document.getElementById('detail-assigned-to').value || null;
                const servisTipi = document.getElementById('detail-servis-tipi').value;
                const isUcretli = servisTipi === 'Ucretli';

                const payload = {
                    status,
                    caller_name,
                    caller_phone,
                    assigned_to,
                    servis_tipi: servisTipi,
                    fiyat: isUcretli ? (parseFloat(document.getElementById('detail-fiyat').value) || null) : null,
                    odeme_durumu: isUcretli ? (document.getElementById('detail-odeme-durumu').value || 'Odenmedi') : null,
                    subject: document.getElementById('detail-subject').value.trim() || null,
                    description: document.getElementById('detail-description').value.trim() || null,
                    resolution: document.getElementById('detail-resolution').value.trim() || null,
                    notes: document.getElementById('detail-notes').value.trim() || null
                };

                if (!payload.caller_name || !payload.subject) {
                    showToast('Arayan kisi ve konu zorunludur.', 'error');
                    saveChangesBtn.disabled = false;
                    saveChangesBtn.textContent = 'Değişiklikleri Kaydet';
                    return;
                }

                if (['Cozuldu', 'Kapali'].includes(payload.status) && !s.end_time) {
                    payload.end_time = new Date().toISOString();
                }

                try {
                    const { error } = await supabase
                        .from('technical_supports')
                        .update(payload)
                        .eq('id', s.id);
                    
                    if (error) throw error;
                    showToast('Değişiklikler başarıyla kaydedildi.', 'success');
                    closeModal('support-detail-modal');
                    window.dispatchEvent(new CustomEvent('support-updated'));
                } catch (err) {
                    showToast(translateError(err), 'error');
                    saveChangesBtn.disabled = false;
                    saveChangesBtn.textContent = 'Değişiklikleri Kaydet';
                }
            };
        }

    } else {
        const serviceBadge = getServiceBadgeHTML(s);

        document.getElementById('detail-modal-body').innerHTML = `
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-gray-400 text-xs">Müşteri</span><p class="font-medium text-gray-800">${escHtml(customer)}</p></div>
                <div><span class="text-gray-400 text-xs">Durum</span><div class="mt-0.5">${statusBadge(s.status)}</div></div>
                <div><span class="text-gray-400 text-xs">Arayan</span><p class="text-gray-700">${escHtml(s.caller_name)} ${s.caller_phone ? `<span class="text-gray-400">(${escHtml(s.caller_phone)})</span>` : ''}</p></div>
                <div><span class="text-gray-400 text-xs">Başlangıç</span><p class="text-gray-700">${formatDateTime(s.start_time)}</p></div>
                <div class="col-span-2">
                    <span class="text-gray-400 text-xs">Servis Bilgisi</span>
                    <div class="mt-1">${serviceBadge}</div>
                </div>
            </div>
            <div>
                <p class="text-xs text-gray-400 mb-1">Konu</p>
                <p class="text-gray-800 font-medium">${escHtml(s.subject)}</p>
            </div>
            ${s.description ? `<div><p class="text-xs text-gray-400 mb-1">Açıklama</p><p class="text-gray-700 text-sm whitespace-pre-wrap">${escHtml(s.description)}</p></div>` : ''}
            ${s.resolution ? `<div><p class="text-xs text-gray-400 mb-1">Çözüm</p><p class="text-gray-700 text-sm whitespace-pre-wrap">${escHtml(s.resolution)}</p></div>` : ''}
            <div>
                <p class="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Log Kayıtları</p>
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

        document.getElementById('detail-modal-footer').innerHTML = `
            <button type="button" data-close-modal="support-detail-modal"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Kapat</button>
        `;
    }

    openModal('support-detail-modal');

    // Add log event listener
    const addLogBtn = document.getElementById('btn-add-log');
    if (addLogBtn) {
        addLogBtn.onclick = async () => {
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
            await showSupportDetail(s, profile);
        };
    }
}

