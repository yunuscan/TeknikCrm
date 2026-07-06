import { supabase }                        from '../supabase-config.js';
import { setContent, escHtml, formatDate, statusBadge, priorityBadge } from '../utils.js';

// ---------------------------------------------------
// Ana render fonksiyonu
// ---------------------------------------------------

export async function renderDashboard({ profile }) {
    const today = new Date().toISOString().split('T')[0];

    const [
        customersResult,
        supportsResult,
        tasksResult,
        visitsResult,
        overdueResult,
    ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('technical_supports').select('*', { count: 'exact', head: true }).in('status', ['Acik', 'Devam Ediyor']),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'Bekliyor'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'Planlandi').gte('visit_date', today),
        supabase
            .from('tasks')
            .select('id, title, end_date, priority, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
            .eq('status', 'Gecikti')
            .order('end_date', { ascending: true })
            .limit(15),
    ]);

    const stats = {
        totalCustomers: customersResult.count  || 0,
        activeSupports: supportsResult.count   || 0,
        pendingTasks:   tasksResult.count       || 0,
        plannedVisits:  visitsResult.count      || 0,
    };

    const overdueTasks = overdueResult.data || [];

    setContent(buildHTML(stats, overdueTasks, profile));
    bindEvents();
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(stats, overdueTasks, profile) {
    const overdueRows = overdueTasks.length
        ? overdueTasks.map(buildTaskRow).join('')
        : `<tr><td colspan="5" class="px-5 py-10 text-center text-gray-400 text-sm">Geciken gorev bulunmamaktadir.</td></tr>`;

    return `
        <div class="max-w-7xl mx-auto">

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

            <!-- Geciken Gorevler Tablosu -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 class="text-base font-semibold text-gray-800">Geciken Gorevler</h2>
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                        ${overdueTasks.length} kayit
                    </span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-5 py-3 font-medium">Baslik</th>
                                <th class="px-5 py-3 font-medium">Musteri</th>
                                <th class="px-5 py-3 font-medium">Oncelik</th>
                                <th class="px-5 py-3 font-medium">Bitis</th>
                                <th class="px-5 py-3 font-medium">Atanan</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${overdueRows}
                        </tbody>
                    </table>
                </div>
                <div class="px-5 py-3 border-t border-gray-100">
                    <a href="#" data-view="tasks" class="nav-link text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        Tum gorevleri goster
                    </a>
                </div>
            </div>

        </div>
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

function buildTaskRow(task) {
    const customer = task.customers
        ? escHtml(task.customers.company_name || `${task.customers.first_name} ${task.customers.last_name}`)
        : '-';
    const assignee = task.assigned?.full_name ? escHtml(task.assigned.full_name) : '-';

    return `
        <tr class="hover:bg-red-50 transition-colors">
            <td class="px-5 py-3 font-medium text-gray-800">${escHtml(task.title)}</td>
            <td class="px-5 py-3 text-gray-600">${customer}</td>
            <td class="px-5 py-3">${priorityBadge(task.priority)}</td>
            <td class="px-5 py-3 text-red-600 font-medium">${formatDate(task.end_date)}</td>
            <td class="px-5 py-3 text-gray-600">${assignee}</td>
        </tr>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents() {
    // nav-link tiklari app.js'deki event delegation tarafindan yonetilir
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
