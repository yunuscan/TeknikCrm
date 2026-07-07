import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    statusBadge, priorityBadge, openModal, closeModal,
    buildOptions, translateError, setPageTitle,
} from '../utils.js';
import { buildTaskDetailModal, showTaskDetail } from './details.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderTasks({ profile }) {
    console.log('Aktif Rol:', profile?.role);
    setPageTitle('Görevler');

    const [tasksRes, customersRes, staffRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('*, customers(id, first_name, last_name, company_name), assigned:profiles!tasks_assigned_to_fkey(id, full_name)')
            .order('end_date', { ascending: true, nullsFirst: false }),
        supabase.from('customers').select('id, first_name, last_name, company_name').eq('is_active', true).order('company_name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);

    if (tasksRes.error) {
        showToast('Görevler yuklenemedi: ' + tasksRes.error.message, 'error');
        return;
    }

    const tasks     = tasksRes.data    || [];
    
    const customers = customersRes.data || [];
    const staff     = staffRes.data    || [];

    const canWrite  = ['Yönetici', 'Teknik Servis', 'Satış Personeli'].includes(profile?.role);
    const canDelete = profile?.role === 'Yönetici';

    setContent(buildHTML(tasks, customers, staff, canWrite, canDelete, profile));
    bindEvents(profile, customers, staff, tasks);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(tasks, customers, staff, canWrite, canDelete, profile) {
    const today = new Date().toISOString().split('T')[0];

    const rows = tasks.length
        ? tasks.map(t => buildRow(t, today, canWrite, canDelete, profile)).join('')
        : `<tr><td colspan="8" class="px-5 py-10 text-center text-sm text-gray-400">Görev bulunamadi.</td></tr>`;

    const custOptions  = buildOptions(customers, 'id', c => c.company_name || `${c.first_name} ${c.last_name}`);
    const staffOptions = buildOptions(staff, 'id', s => s.full_name);

    return `
        <div class="max-w-7xl mx-auto">

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Görevler</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${tasks.length} görev kaydi</p>
                </div>
                <button id="btn-open-create"
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 font-bold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Yeni Görev
                </button>
            </div>

            <!-- Durum filtresi -->
            <div class="flex flex-wrap gap-2 mb-4">
                <button data-filter="" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-300 text-gray-700 bg-gray-100">Tümü</button>
                <button data-filter="Bekliyor" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-yellow-200 text-yellow-700 hover:bg-yellow-50">Bekliyor</button>
                <button data-filter="Gecikti" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-red-200 text-red-700 hover:bg-red-50">Gecikti</button>
                <button data-filter="Tamamlandı" class="filter-btn px-3 py-1.5 text-xs font-semibold rounded-full border border-green-200 text-green-700 hover:bg-green-50">Tamamlandı</button>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Başlık</th>
                                <th class="px-5 py-3 font-medium">Açıklama</th>
                                <th class="px-5 py-3 font-medium">Müşteri</th>
                                <th class="px-5 py-3 font-medium">Atanan</th>
                                <th class="px-5 py-3 font-medium">Öncelik</th>
                                <th class="px-5 py-3 font-medium">Bitiş Tarihi</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                                ${canWrite ? `<th class="px-5 py-3 font-medium text-right">İşlemler</th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="task-table-body" class="divide-y divide-gray-50">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        ${buildModal(custOptions, staffOptions)}
        ${buildTaskDetailModal()}
    `;
}

// ---------------------------------------------------
// Satir uretici
// ---------------------------------------------------

function buildRow(t, today, canWrite, canDelete, profile) {
    const customer = t.customers
        ? escHtml(t.customers.company_name || `${t.customers.first_name} ${t.customers.last_name}`)
        : '-';
    const assignee = t.assigned?.full_name ? escHtml(t.assigned.full_name) : '-';

    const isOverdue = t.end_date && t.end_date < today && t.status !== 'Tamamlandı';

    const canEdit = canWrite && (
        profile?.role === 'Yönetici' ||
        t.assigned?.id === profile?.id ||
        t.customers // baska bir yetkilendirme gerekebilir
    );

    const actions = canWrite ? `
        <div class="flex items-center justify-end gap-2">
            <button data-action="edit" data-id="${t.id}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Duzenle</button>
            ${canDelete ? `<button data-action="delete" data-id="${t.id}" data-name="${escHtml(t.title)}"
                class="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50">Sil</button>` : ''}
        </div>` : '';

    let desc = t.description ? escHtml(t.description) : '-';
    if (desc.length > 55) {
        desc = desc.substring(0, 55) + '...';
    }

    return `
        <tr class="cursor-pointer ${isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'} transition-colors" data-status="${escHtml(t.status)}" data-id="${t.id}">
            <td class="px-5 py-3 font-medium text-gray-800">${escHtml(t.title)}</td>
            <td class="px-5 py-3 text-gray-500 text-xs max-w-[200px]">${desc}</td>
            <td class="px-5 py-3 text-gray-600">${customer}</td>
            <td class="px-5 py-3 text-gray-600">${assignee}</td>
            <td class="px-5 py-3">${priorityBadge(t.priority)}</td>
            <td class="px-5 py-3 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}">${formatDate(t.end_date)}</td>
            <td class="px-5 py-3">${statusBadge(t.status)}</td>
            ${canWrite ? `<td class="px-5 py-3">${actions}</td>` : ''}
        </tr>
    `;
}

// ---------------------------------------------------
// Modal
// ---------------------------------------------------

function buildModal(custOptions, staffOptions) {
    return `
        <div id="task-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay"
            role="dialog" aria-modal="true" aria-hidden="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 id="task-modal-title" class="text-lg font-semibold text-gray-800">Yeni Görev</h3>
                    <button data-close-modal="task-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <form id="task-modal-form" novalidate>
                    <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Başlık <span class="text-red-500">*</span></label>
                            <input type="text" name="title" required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                            <textarea name="description" rows="3"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Müşteri</label>
                            <select name="customer_id"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">-- Secin --</option>
                                ${custOptions}
                            </select>
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
                            <label class="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
                            <select name="priority"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Orta">Orta</option>
                                <option value="Yuksek">Yuksek</option>
                                <option value="Dusuk">Dusuk</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select name="status"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="Bekliyor">Bekliyor</option>
                                <option value="Tamamlandı">Tamamlandı</option>
                                <option value="Gecikti">Gecikti</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                            <input type="date" name="start_date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                            <input type="date" name="end_date"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Başlangıç Saati</label>
                            <input type="time" name="start_time"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Bitiş Saati</label>
                            <input type="time" name="end_time"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                    </div>
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                        <button type="button" data-close-modal="task-modal"
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

function bindEvents(profile, customers, staff, tasks) {
    document.getElementById('btn-open-create')?.addEventListener('click', () => {
        document.getElementById('task-modal-title').textContent = 'Yeni Görev';
        document.getElementById('task-modal-form').dataset.editId = '';
        document.getElementById('task-modal-form').reset();
        openModal('task-modal');
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

    document.getElementById('task-table-body')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
            const id     = btn.dataset.id;
            const action = btn.dataset.action;
            const task   = tasks.find(t => t.id === id);

            if (action === 'edit' && task) {
                document.getElementById('task-modal-title').textContent = 'Görev Duzenle';
                document.getElementById('task-modal-form').dataset.editId = id;
                fillTaskForm(document.getElementById('task-modal-form'), task);
                openModal('task-modal');
            }

            if (action === 'delete') {
                const name = btn.dataset.name;
                if (!confirm(`"${name}" görevi silinecek. Emin misiniz?`)) return;
                const { error } = await supabase.from('tasks').delete().eq('id', id);
                if (error) { showToast(translateError(error), 'error'); return; }
                showToast('Görev silindi.', 'success');
                await renderTasks({ profile });
            }
            return;
        }

        const row = e.target.closest('tr[data-id]');
        if (row) {
            const id = row.dataset.id;
            const task = tasks.find(t => t.id === id);
            if (task) {
                showTaskDetail(task);
            }
        }
    });

    document.getElementById('task-modal-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await saveTask(e.target, profile);
    });
}

// ---------------------------------------------------
// Form doldur
// ---------------------------------------------------

function fillTaskForm(form, t) {
    form.querySelector('[name="title"]').value       = t.title       || '';
    form.querySelector('[name="description"]').value = t.description || '';
    form.querySelector('[name="customer_id"]').value = t.customer_id || '';
    form.querySelector('[name="assigned_to"]').value = t.assigned_to || '';
    form.querySelector('[name="priority"]').value    = t.priority    || 'Orta';
    form.querySelector('[name="status"]').value      = t.status      || 'Bekliyor';
    form.querySelector('[name="start_date"]').value  = t.start_date  || '';
    form.querySelector('[name="end_date"]').value    = t.end_date    || '';
    form.querySelector('[name="start_time"]').value  = t.start_time  || '';
    form.querySelector('[name="end_time"]').value    = t.end_time    || '';
}

// ---------------------------------------------------
// CRUD - Kaydet
// ---------------------------------------------------

async function saveTask(form, profile) {
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';

    const editId = form.dataset.editId;
    const fd     = new FormData(form);

    const payload = {
        title:       fd.get('title')?.trim()    || null,
        description: fd.get('description')?.trim() || null,
        customer_id: fd.get('customer_id')      || null,
        assigned_to: fd.get('assigned_to')      || null,
        priority:    fd.get('priority')         || 'Orta',
        status:      fd.get('status')           || 'Bekliyor',
        start_date:  fd.get('start_date')       || null,
        end_date:    fd.get('end_date')         || null,
        start_time:  fd.get('start_time')       || null,
        end_time:    fd.get('end_time')         || null,
    };

    if (!payload.title) {
        showToast('Görev basligi zorunludur.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
        return;
    }

    try {
        let error;
        if (editId) {
            ({ error } = await supabase.from('tasks').update(payload).eq('id', editId));
        } else {
            payload.created_by = (await supabase.auth.getUser()).data.user?.id;
            ({ error } = await supabase.from('tasks').insert(payload));
        }
        if (error) throw error;
        showToast(editId ? 'Görev güncellendi.' : 'Görev olusturuldu.', 'success');
        closeModal('task-modal');
        await renderTasks({ profile });
    } catch (err) {
        showToast(translateError(err), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kaydet';
    }
}
