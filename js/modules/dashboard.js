import { supabase }                        from '../supabase-config.js';
import {
    setContent, escHtml, formatDate, formatDateTime,
    statusBadge, priorityBadge, closeModal
} from '../utils.js';
import {
    buildTaskDetailModal, showTaskDetail,
    buildVisitDetailModal, showVisitDetail,
    buildSupportDetailModal, showSupportDetail
} from './details.js';

// ---------------------------------------------------
// Ana render fonksiyonu
// ---------------------------------------------------

export async function renderDashboard({ profile }) {
    const today = new Date().toISOString().split('T')[0];

    const [
        customersCountRes,
        supportsCountRes,
        tasksCountRes,
        visitsCountRes,
        tasksListRes,
        visitsListRes,
        supportsListRes,
    ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('technical_supports').select('*', { count: 'exact', head: true }).in('status', ['Acik', 'Devam Ediyor']),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['Bekliyor', 'Gecikti']),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'Planlandi'),
        supabase
            .from('tasks')
            .select('*, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
            .in('status', ['Bekliyor', 'Gecikti'])
            .order('end_date', { ascending: true })
            .limit(10),
        supabase
            .from('visits')
            .select('*, customers(company_name, first_name, last_name, address), assigned:profiles!visits_assigned_to_fkey(full_name)')
            .eq('status', 'Planlandi')
            .order('visit_date', { ascending: true })
            .limit(10),
        supabase
            .from('technical_supports')
            .select('*, customers(company_name, first_name, last_name), assigned:profiles!technical_supports_assigned_to_fkey(full_name)')
            .in('status', ['Acik', 'Devam Ediyor'])
            .order('created_at', { ascending: false })
            .limit(10),
    ]);

    const stats = {
        totalCustomers: customersCountRes.count  || 0,
        activeSupports: supportsCountRes.count   || 0,
        pendingTasks:   tasksCountRes.count       || 0,
        plannedVisits:  visitsCountRes.count      || 0,
    };

    const activeTasks = tasksListRes.data || [];
    const plannedVisits = visitsListRes.data || [];
    const activeSupports = supportsListRes.data || [];

    setContent(buildHTML(stats, activeTasks, plannedVisits, activeSupports, profile, today));
    bindEvents(activeTasks, plannedVisits, activeSupports, profile);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(stats, activeTasks, plannedVisits, activeSupports, profile, today) {
    const taskRows = activeTasks.length
        ? activeTasks.map(t => buildTaskRow(t, today)).join('')
        : `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 text-sm">Aktif gorev bulunmamaktadir.</td></tr>`;

    const visitRows = plannedVisits.length
        ? plannedVisits.map(v => buildVisitRow(v, today)).join('')
        : `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 text-sm">Planlanmis ziyaret bulunmamaktadir.</td></tr>`;

    const supportRows = activeSupports.length
        ? activeSupports.map(buildSupportRow).join('')
        : `<tr><td colspan="7" class="px-5 py-8 text-center text-gray-400 text-sm">Acik destek kaydi bulunmamaktadir.</td></tr>`;

    return `
        <div class="max-w-7xl mx-auto" id="dashboard-wrapper">

            <!-- Baslik -->
            <div class="mb-7">
                <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
                <p class="text-sm text-gray-500 mt-0.5">Hosgeldiniz, ${escHtml(profile.full_name)}</p>
            </div>

            <!-- Ozet Kartlar -->
            <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                ${buildStatCard('Aktif Musteriler',      stats.totalCustomers, 'text-indigo-600', iconUsers())}
                ${buildStatCard('Acik Destek Kayitlari', stats.activeSupports, 'text-orange-500', iconSupport())}
                ${buildStatCard('Bekleyen Gorevler',     stats.pendingTasks,   'text-yellow-600', iconTask())}
                ${buildStatCard('Planlanan Ziyaretler',  stats.plannedVisits,  'text-green-600',  iconVisit())}
            </div>

            <!-- Iki kolonlu tablo alani (Gorevler & Ziyaretler) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                
                <!-- Gorevler Tablosu -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
                    <div>
                        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 class="text-base font-semibold text-gray-800">Aktif Gorevler</h2>
                            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                Son ${activeTasks.length} kayit
                            </span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th class="px-4 py-3 font-medium">Baslik</th>
                                        <th class="px-4 py-3 font-medium">Musteri</th>
                                        <th class="px-4 py-3 font-medium">Oncelik</th>
                                        <th class="px-4 py-3 font-medium">Bitis</th>
                                        <th class="px-4 py-3 font-medium">Durum</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-50">
                                    ${taskRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="px-5 py-3 border-t border-gray-100">
                        <a href="#" data-view="tasks" class="nav-link text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                            Tum gorevleri goster
                        </a>
                    </div>
                </div>

                <!-- Ziyaretler Tablosu -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
                    <div>
                        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 class="text-base font-semibold text-gray-800">Planlanan Ziyaretler</h2>
                            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                                Son ${plannedVisits.length} kayit
                            </span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th class="px-4 py-3 font-medium">Musteri</th>
                                        <th class="px-4 py-3 font-medium">Tarih</th>
                                        <th class="px-4 py-3 font-medium">Amac</th>
                                        <th class="px-4 py-3 font-medium">Durum</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-50">
                                    ${visitRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="px-5 py-3 border-t border-gray-100">
                        <a href="#" data-view="visits" class="nav-link text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                            Tum ziyaretleri goster
                        </a>
                    </div>
                </div>

            </div>

            <!-- Teknik Destek Tablosu -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 class="text-base font-semibold text-gray-800">Acik Destek Kayitlari</h2>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Son ${activeSupports.length} kayit
                    </span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">No</th>
                                <th class="px-5 py-3 font-medium">Musteri</th>
                                <th class="px-5 py-3 font-medium">Konu</th>
                                <th class="px-5 py-3 font-medium">Arayan</th>
                                <th class="px-5 py-3 font-medium">Atanan</th>
                                <th class="px-5 py-3 font-medium">Baslangic</th>
                                <th class="px-5 py-3 font-medium">Durum</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${supportRows}
                        </tbody>
                    </table>
                </div>
                <div class="px-5 py-3 border-t border-gray-100">
                    <a href="#" data-view="technical-support" class="nav-link text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        Tum destek kayitlarini goster
                    </a>
                </div>
            </div>

        </div>

        <!-- Detay Modallari -->
        ${buildTaskDetailModal()}
        ${buildVisitDetailModal()}
        ${buildSupportDetailModal()}
    `;
}

function buildStatCard(label, value, valueColor, iconHtml) {
    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div class="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                ${iconHtml}
            </div>
            <div>
                <p class="text-xs font-medium text-gray-500">${label}</p>
                <p class="text-2xl font-bold ${valueColor} mt-0.5">${value}</p>
            </div>
        </div>
    `;
}

function buildTaskRow(task, today) {
    const customer = task.customers
        ? escHtml(task.customers.company_name || `${task.customers.first_name} ${task.customers.last_name}`)
        : '-';
    const isOverdue = task.end_date && task.end_date < today && task.status !== 'Tamamlandi';

    return `
        <tr class="cursor-pointer ${isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'} transition-colors" data-type="task" data-id="${task.id}">
            <td class="px-4 py-3 font-medium text-gray-800 truncate max-w-[150px]">${escHtml(task.title)}</td>
            <td class="px-4 py-3 text-gray-600 truncate max-w-[150px]">${customer}</td>
            <td class="px-4 py-3">${priorityBadge(task.priority)}</td>
            <td class="px-4 py-3 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}">${formatDate(task.end_date)}</td>
            <td class="px-4 py-3">${statusBadge(task.status)}</td>
        </tr>
    `;
}

function buildVisitRow(visit, today) {
    const customer = visit.customers
        ? escHtml(visit.customers.company_name || `${visit.customers.first_name} ${visit.customers.last_name}`)
        : '-';
    const isPast = visit.visit_date && visit.visit_date < today && visit.status === 'Planlandi';
    const timeStr = visit.visit_time ? visit.visit_time.slice(0, 5) : '';

    return `
        <tr class="cursor-pointer ${isPast ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-slate-50'} transition-colors" data-type="visit" data-id="${visit.id}">
            <td class="px-4 py-3 font-medium text-gray-800 truncate max-w-[150px]">${customer}</td>
            <td class="px-4 py-3">
                <span class="${isPast ? 'text-orange-600 font-semibold' : 'text-gray-700'}">${formatDate(visit.visit_date)}</span>
                ${timeStr ? `<span class="ml-1 text-xs text-gray-400">${timeStr}</span>` : ''}
            </td>
            <td class="px-4 py-3 text-gray-600 truncate max-w-[150px]">${escHtml(visit.purpose) || '-'}</td>
            <td class="px-4 py-3">${statusBadge(visit.status)}</td>
        </tr>
    `;
}

function buildSupportRow(support) {
    const customer = support.customers
        ? escHtml(support.customers.company_name || `${support.customers.first_name} ${support.customers.last_name}`)
        : '-';
    const assignee = support.assigned?.full_name ? escHtml(support.assigned.full_name) : '-';

    return `
        <tr class="cursor-pointer hover:bg-slate-50 transition-colors" data-type="support" data-id="${support.id}">
            <td class="px-5 py-3">
                <span class="support-number-badge text-indigo-700">#${support.support_number}</span>
            </td>
            <td class="px-5 py-3 font-medium text-gray-800">${customer}</td>
            <td class="px-5 py-3 text-gray-700 truncate max-w-xs">${escHtml(support.subject)}</td>
            <td class="px-5 py-3 text-gray-600">${escHtml(support.caller_name)}</td>
            <td class="px-5 py-3 text-gray-600">${assignee}</td>
            <td class="px-5 py-3 text-gray-500 text-xs">${formatDateTime(support.start_time)}</td>
            <td class="px-5 py-3">${statusBadge(support.status)}</td>
        </tr>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(activeTasks, plannedVisits, activeSupports, profile) {
    // Tablo satiri tiklama olayi
    document.getElementById('dashboard-wrapper')?.addEventListener('click', async (e) => {
        const row = e.target.closest('tr[data-type]');
        if (!row) return;

        // Eger tiklanan oge link, buton veya form elemani ise detay acma
        if (e.target.closest('a, button, input, select, textarea')) return;

        const type = row.dataset.type;
        const id = row.dataset.id;

        if (type === 'task') {
            const task = activeTasks.find(t => t.id === id);
            if (task) showTaskDetail(task);
        } else if (type === 'visit') {
            const visit = plannedVisits.find(v => v.id === id);
            if (visit) showVisitDetail(visit);
        } else if (type === 'support') {
            const support = activeSupports.find(s => s.id === id);
            if (support) showSupportDetail(support, profile);
        }
    });

    // data-close-modal butonlari icin kapatma dinleyicisi
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
}

// ---------------------------------------------------
// Satir ici SVG ikonlar
// ---------------------------------------------------

function iconUsers() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
}

function iconSupport() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
}

function iconTask() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
}

function iconVisit() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
}
