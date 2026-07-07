import { supabase } from '../supabase-config.js';
import {
    escHtml, formatDate, formatDateTime,
    statusBadge, priorityBadge, openModal, closeModal,
    showToast, translateError
} from '../utils.js';

// ---------------------------------------------------
// Gorev Detay Modali
// ---------------------------------------------------

export function buildTaskDetailModal() {
    return `
        <div id="task-detail-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800">Gorev Detayi</h3>
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
                <span class="text-gray-400 text-xs">Musteri</span>
                <p class="font-medium text-gray-800">${escHtml(customer)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Atanan Personel</span>
                <p class="font-medium text-gray-800">${escHtml(assignee)}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Oncelik</span>
                <div class="mt-1">${priorityBadge(t.priority)}</div>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Durum</span>
                <div class="mt-1">${statusBadge(t.status)}</div>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Baslangic Tarihi</span>
                <p class="font-medium text-gray-800">${formatDate(t.start_date)} ${t.start_time ? `(${t.start_time.slice(0, 5)})` : ''}</p>
            </div>
            <div>
                <span class="text-gray-400 text-xs">Bitis Tarihi</span>
                <p class="font-medium text-gray-800">${formatDate(t.end_date)} ${t.end_time ? `(${t.end_time.slice(0, 5)})` : ''}</p>
            </div>
        </div>
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Baslik</span>
            <p class="font-semibold text-gray-800 text-base mt-0.5">${escHtml(t.title)}</p>
        </div>
        ${t.description ? `
        <div class="pt-3 border-t border-gray-100">
            <span class="text-gray-400 text-xs">Aciklama</span>
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
                <span class="text-gray-400 text-xs">Musteri</span>
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
                <div class="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button type="button" data-close-modal="support-detail-modal"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Kapat</button>
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

    const canLog = ['Yonetici', 'Teknik Servis'].includes(profile?.role);

    document.getElementById('detail-modal-title').textContent = `Destek #${s.support_number}`;
    document.getElementById('detail-modal-body').innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-400 text-xs">Musteri</span><p class="font-medium text-gray-800">${escHtml(customer)}</p></div>
            <div><span class="text-gray-400 text-xs">Durum</span><div class="mt-0.5">${statusBadge(s.status)}</div></div>
            <div><span class="text-gray-400 text-xs">Arayan</span><p class="text-gray-700">${escHtml(s.caller_name)} ${s.caller_phone ? `<span class="text-gray-400">(${escHtml(s.caller_phone)})</span>` : ''}</p></div>
            <div><span class="text-gray-400 text-xs">Baslangic</span><p class="text-gray-700">${formatDateTime(s.start_time)}</p></div>
        </div>
        <div>
            <p class="text-xs text-gray-400 mb-1">Konu</p>
            <p class="text-gray-800 font-medium">${escHtml(s.subject)}</p>
        </div>
        ${s.description ? `<div><p class="text-xs text-gray-400 mb-1">Aciklama</p><p class="text-gray-700 text-sm whitespace-pre-wrap">${escHtml(s.description)}</p></div>` : ''}
        ${s.resolution ? `<div><p class="text-xs text-gray-400 mb-1">Cozum</p><p class="text-gray-700 text-sm whitespace-pre-wrap">${escHtml(s.resolution)}</p></div>` : ''}
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
