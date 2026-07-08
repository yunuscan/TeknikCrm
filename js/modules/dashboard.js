import { supabase } from '../supabase-config.js';
import {
    setContent, escHtml, formatDate, formatDateTime,
    statusBadge, priorityBadge, closeModal, getServiceBadgeHTML
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
    console.log('Aktif Rol:', profile?.role);
    const today = new Date().toISOString().split('T')[0];
    const warnDate = new Date(); warnDate.setDate(warnDate.getDate() + 30);
    const warnStr = warnDate.toISOString().split('T')[0];

    const [
        tasksOverdueRes,
        supportsOpenRes,
        licensesExpiredRes,
        overdueTasksListRes,
        todayVisitsListRes,
        todayTasksListRes,
        upcomingLicensesListRes,
        activeSupportsListRes,
    ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'Gecikti'),
        supabase.from('technical_supports').select('*', { count: 'exact', head: true }).in('status', ['Acik', 'Devam Ediyor']),
        supabase.from('licenses').select('*', { count: 'exact', head: true }).lt('maintenance_end', today),

        supabase
            .from('tasks')
            .select('*, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
            .in('status', ['Bekliyor', 'Gecikti', 'Devam Ediyor'])
            .order('end_date', { ascending: true })
            .limit(10),

        supabase
            .from('visits')
            .select('*, customers(company_name, first_name, last_name, address), assigned:profiles!visits_assigned_to_fkey(full_name)')
            .eq('visit_date', today)
            .order('visit_time', { ascending: true }),

        supabase
            .from('tasks')
            .select('*, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
            .eq('end_date', today)
            .neq('status', 'Tamamlandı') // Sadece acik olanlar
            .order('title', { ascending: true }),

        supabase
            .from('licenses')
            .select('*, customers(company_name, first_name, last_name)')
            .gte('maintenance_end', today)
            .lte('maintenance_end', warnStr)
            .order('maintenance_end', { ascending: true }),

        supabase
            .from('technical_supports')
            .select('*, customers(company_name, first_name, last_name), assigned:profiles!technical_supports_assigned_to_fkey(full_name)')
            .in('status', ['Acik', 'Devam Ediyor'])
            .order('created_at', { ascending: false })
            .limit(8)
    ]);

    const activeVisits = todayVisitsListRes.data || [];
    const activeTasks = todayTasksListRes.data || [];
    const activeTasksList = overdueTasksListRes.data || [];

    const upcomingLicenses = upcomingLicensesListRes.data || [];
    const activeSupports = activeSupportsListRes.data || [];

    const todayAgendaCount = activeVisits.length + activeTasks.length;

    const stats = {
        overdueTasks: tasksOverdueRes.count || 0,
        openSupports: supportsOpenRes.count || 0,
        expiredLicenses: licensesExpiredRes.count || 0,
        todayAgenda: todayAgendaCount,
    };

    setContent(buildHTML(stats, activeTasksList, activeTasks, activeVisits, activeSupports, profile, today, warnStr));
    bindEvents(activeTasksList, activeTasks, activeVisits, activeSupports, profile);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(stats, activeTasksList, todayTasks, todayVisits, activeSupports, profile, today, warnStr) {
    const activeCards = activeTasksList.length
        ? activeTasksList.map(t => buildTaskCard(t, today, true)).join('')
        : `<div class="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
             <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-400">
                ${iconTask()}
             </div>
             <p class="text-sm font-medium text-gray-500">Aktif görev bulunmuyor.</p>
           </div>`;

    const taskCards = todayTasks.map(t => buildTaskCard(t, today, false));
    const visitCards = todayVisits.map(v => buildVisitCard(v, today));

    const agendaCardsHtml = (taskCards.length || visitCards.length)
        ? [...taskCards, ...visitCards].join('')
        : `<div class="py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">Bugün için planlanmış kayıt yok.</div>`;

    const supportCards = activeSupports.length
        ? activeSupports.map(s => buildSupportCard(s)).join('')
        : `<div class="py-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
             <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2 text-gray-400">
                ${iconSupport()}
             </div>
             <p class="text-sm font-medium text-gray-500">Aktif destek kaydı bulunmuyor.</p>
           </div>`;

    return `
        <div class="max-w-7xl mx-auto" id="dashboard-wrapper">

            <!-- Başlık -->
            <div class="mb-6 flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
                    <p class="text-sm text-gray-500 mt-0.5">Hoşgeldiniz, ${escHtml(profile.full_name)}</p>
                </div>
                <div class="text-right hidden sm:block">
                    <p class="text-sm font-semibold text-gray-800">${formatDate(today)}</p>
                    <p class="text-xs font-medium text-gray-500">Bugünün Özeti</p>
                </div>
            </div>

            <!-- BENTO GRID CONTAINER -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                <!-- Özet Kartlar (Top Row, 12 cols span) -->
                <div class="lg:col-span-12 grid grid-cols-2 xl:grid-cols-4 gap-3">
                    ${buildStatCard('Geciken Görevler', stats.overdueTasks, 'text-red-600', 'bg-red-50 text-red-500', iconTask())}
                    ${buildStatCard('Açık Destekler', stats.openSupports, 'text-orange-600', 'bg-orange-50 text-orange-500', iconSupport())}
                    ${buildStatCard('Bakımı Geçen Lisans', stats.expiredLicenses, 'text-red-600', 'bg-red-50 text-red-500', iconLicense())}
                    ${buildStatCard('Bugünün Ajandası', stats.todayAgenda, 'text-indigo-600', 'bg-indigo-50 text-indigo-500', iconCalendar())}
                </div>

                <!-- Aktif Görevler Bento Box (span 8) -->
                <div class="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col" style="height:calc(100vh - 240px)">
                    <div class="flex items-center justify-between mb-4 flex-shrink-0">
                        <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                            Görevler
                        </h2>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                ${activeTasksList.length} Görev
                            </span>
                            <a href="#" data-view="tasks" class="nav-link inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors" title="Yeni Görev">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Yeni
                            </a>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-grow content-start pr-1">
                        ${activeCards}
                    </div>
                </div>

                <!-- Sağ Kenar Bento Box (span 4) -->
                <div class="lg:col-span-4 flex flex-col gap-4" style="height:calc(100vh - 240px)">
                    
                    <!-- Bugünün Ajandası -->
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col min-h-0 flex-1">
                        <div class="flex items-center justify-between mb-4 flex-shrink-0">
                            <h2 class="text-base font-bold text-gray-800">Takvim</h2>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    ${stats.todayAgenda} Kayıt
                                </span>
                                <a href="#" data-view="visits" class="nav-link inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors" title="Yeni Ziyaret">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                    Yeni
                                </a>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2.5 overflow-y-auto flex-grow pr-1">
                            ${agendaCardsHtml}
                        </div>
                    </div>

                    <!-- Aktif Destek Kayıtları -->
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col min-h-0 flex-1">
                        <div class="flex items-center justify-between mb-4 flex-shrink-0">
                            <h2 class="text-base font-bold text-gray-800">Teknik Destek</h2>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                                    ${activeSupports.length} Kayıt
                                </span>
                                <a href="#" data-view="technical-support" class="nav-link inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg hover:bg-orange-100 transition-colors" title="Yeni Destek">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                    Yeni
                                </a>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2.5 overflow-y-auto flex-grow pr-1">
                            ${supportCards}
                        </div>
                    </div>

                </div>
            </div>

        </div>

        <!-- Detay Modallari -->
        ${buildTaskDetailModal()}
        ${buildVisitDetailModal()}
        ${buildSupportDetailModal()}
    `;
}

function buildStatCard(label, value, valueColor, iconBgClass, iconHtml) {
    return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl ${iconBgClass} flex items-center justify-center flex-shrink-0">
                ${iconHtml}
            </div>
            <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${label}</p>
                <p class="text-2xl font-black ${valueColor} mt-0.5 leading-none">${value}</p>
            </div>
        </div>
    `;
}

function buildTaskCard(task, today, isTopActiveContext) {
    const customer = task.customers
        ? escHtml(task.customers.company_name || `${task.customers.first_name} ${task.customers.last_name}`)
        : '-';

    if (isTopActiveContext) {
        let desc = task.description ? escHtml(task.description) : 'Açıklama bulunmuyor.';
        if (desc.length > 70) desc = desc.substring(0, 70) + '...';

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all p-4 cursor-pointer flex flex-col group relative" data-type="task" data-id="${task.id}">
                <div class="flex justify-between items-start mb-3">
                    ${statusBadge(task.status)}
                    <span class="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">${formatDate(task.end_date)}</span>
                </div>
                <h3 class="font-bold text-gray-800 text-sm mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">${escHtml(task.title)}</h3>
                <p class="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed flex-grow">${desc}</p>
                <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                    <span class="text-xs font-semibold text-gray-600 truncate max-w-[120px]" title="${customer}">
                        ${customer}
                    </span>
                    ${priorityBadge(task.priority)}
                </div>
            </div>
        `;
    }

    // Bugünün Ajandası (Görev)
    const timeStr = task.end_time ? task.end_time.slice(0, 5) : '-';
    return `
        <div class="bg-slate-50 rounded-xl border border-slate-100 p-3 hover:bg-white hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group flex flex-col gap-2" data-type="task" data-id="${task.id}">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm"></span>
                    <span class="text-xs font-bold text-purple-700 uppercase tracking-wide">Görev</span>
                </div>
                <span class="text-xs font-bold text-gray-500">${timeStr}</span>
            </div>
            <div>
                <h3 class="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">${escHtml(task.title)}</h3>
                <p class="text-xs text-gray-500 line-clamp-1 mt-0.5 font-medium">${customer}</p>
            </div>
        </div>
    `;
}

function buildVisitCard(visit, today) {
    const customer = visit.customers
        ? escHtml(visit.customers.company_name || `${visit.customers.first_name} ${visit.customers.last_name}`)
        : '-';
    const timeStr = visit.visit_time ? visit.visit_time.slice(0, 5) : '-';

    // Bugünün Ajandası (Ziyaret)
    return `
        <div class="bg-slate-50 rounded-xl border border-slate-100 p-3 hover:bg-white hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex flex-col gap-2" data-type="visit" data-id="${visit.id}">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
                    <span class="text-xs font-bold text-emerald-700 uppercase tracking-wide">Ziyaret</span>
                </div>
                <span class="text-xs font-bold text-gray-500">${timeStr}</span>
            </div>
            <div>
                <h3 class="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors">${customer}</h3>
                <p class="text-xs text-gray-500 line-clamp-1 mt-0.5 font-medium">${escHtml(visit.purpose || 'Ziyaret detayı yok')}</p>
            </div>
        </div>
    `;
}

function buildSupportCard(support) {
    const customer = support.customers
        ? escHtml(support.customers.company_name || `${support.customers.first_name} ${support.customers.last_name}`)
        : '-';

    const timeStr = support.start_time
        ? formatDateTime(support.start_time)
        : '-';

    const serviceBadge = getServiceBadgeHTML(support);

    return `
        <div class="bg-slate-50 rounded-xl border border-slate-100 p-3.5 hover:bg-white hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group flex flex-col gap-2.5" data-type="support" data-id="${support.id}">
            <div class="flex justify-between items-start">
                ${statusBadge(support.status)}
                <span class="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">#${support.support_number || ''}</span>
            </div>
            <div class="flex flex-col gap-0.5">
                <h3 class="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-orange-600 transition-colors">${escHtml(support.subject)}</h3>
                <p class="text-xs font-medium text-gray-500 truncate">${customer}</p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                <span class="text-[11px] text-gray-400 font-medium">${timeStr}</span>
                ${serviceBadge}
            </div>
        </div>
    `;
}



// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(activeTasksList, activeTasks, activeVisits, activeSupports, profile) {
    // Kart tiklama olayi
    document.getElementById('dashboard-wrapper')?.addEventListener('click', async (e) => {
        const item = e.target.closest('[data-type]');
        if (!item) return;

        if (e.target.closest('a, button, input, select, textarea')) return;

        const type = item.dataset.type;
        const id = item.dataset.id;

        if (type === 'task') {
            let task = activeTasks.find(t => t.id === id);
            if (!task) task = activeTasksList.find(t => t.id === id);
            if (task) showTaskDetail(task);
        } else if (type === 'visit') {
            const visit = activeVisits.find(v => v.id === id);
            if (visit) showVisitDetail(visit);
        } else if (type === 'support') {
            const support = activeSupports.find(s => s.id === id);
            if (support) showSupportDetail(support, profile);
        }
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
}

// ---------------------------------------------------
// Satir ici SVG ikonlar
// ---------------------------------------------------

function iconSupport() {
    return `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
}

function iconTask() {
    return `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
}

function iconLicense() {
    return `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>`;
}

function iconCalendar() {
    return `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
}
