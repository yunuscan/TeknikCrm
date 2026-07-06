import { supabase }    from '../supabase-config.js';
import {
    setContent, showToast, escHtml, formatDate,
    statusBadge, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderCalendar({ profile }) {
    setPageTitle('Takvim');

    // Son 7 gun + gelecek 30 gun araligini getir
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 30);

    const startStr = rangeStart.toISOString().split('T')[0];
    const endStr   = rangeEnd.toISOString().split('T')[0];

    const [tasksRes, visitsRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('id, title, end_date, status, priority, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
            .gte('end_date', startStr)
            .lte('end_date', endStr)
            .order('end_date', { ascending: true }),
        supabase
            .from('visits')
            .select('id, visit_date, visit_time, purpose, status, customers(company_name, first_name, last_name), assigned:profiles!visits_assigned_to_fkey(full_name)')
            .gte('visit_date', startStr)
            .lte('visit_date', endStr)
            .order('visit_date', { ascending: true }),
    ]);

    if (tasksRes.error || visitsRes.error) {
        showToast('Takvim verisi yuklenemedi.', 'error');
        return;
    }

    // Tarihe gore grupla
    const eventMap = groupByDate(tasksRes.data || [], visitsRes.data || []);

    setContent(buildHTML(eventMap, startStr, endStr));
}

// ---------------------------------------------------
// Tarihe gore gruplama
// ---------------------------------------------------

function groupByDate(tasks, visits) {
    const map = {};

    tasks.forEach(t => {
        if (!t.end_date) return;
        if (!map[t.end_date]) map[t.end_date] = [];
        map[t.end_date].push({ type: 'task', data: t });
    });

    visits.forEach(v => {
        if (!v.visit_date) return;
        if (!map[v.visit_date]) map[v.visit_date] = [];
        map[v.visit_date].push({ type: 'visit', data: v });
    });

    return map;
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(eventMap, startStr, endStr) {
    const dates = Object.keys(eventMap).sort();
    const today = new Date().toISOString().split('T')[0];

    if (dates.length === 0) {
        return `
            <div class="max-w-4xl mx-auto p-6">
                <h1 class="text-2xl font-bold text-gray-800 mb-6">Takvim</h1>
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400 text-sm">
                    Belirtilen tarih araliginda etkinlik bulunmamaktadir.
                </div>
            </div>
        `;
    }

    const dateBlocks = dates.map(date => buildDateBlock(date, eventMap[date], today)).join('');

    return `
        <div class="max-w-4xl mx-auto">

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">Takvim</h1>
                    <p class="text-sm text-gray-500 mt-0.5">${formatDate(startStr)} - ${formatDate(endStr)} tarihleri arasi</p>
                </div>

                <!-- Renk aciklamasi -->
                <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 rounded-sm border-l-4 border-green-500 bg-green-50 inline-block"></span>Tamamlandi
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 rounded-sm border-l-4 border-yellow-400 bg-yellow-50 inline-block"></span>Bekliyor
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 rounded-sm border-l-4 border-red-500 bg-red-50 inline-block"></span>Gecikti
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="w-3 h-3 rounded-sm border-l-4 border-sky-500 bg-sky-50 inline-block"></span>Ziyaret
                    </span>
                </div>
            </div>

            <div class="space-y-6">
                ${dateBlocks}
            </div>

        </div>
    `;
}

// ---------------------------------------------------
// Tarih blogu uretimi
// ---------------------------------------------------

function buildDateBlock(dateStr, events, today) {
    const d = new Date(dateStr + 'T00:00:00');
    const isToday    = dateStr === today;
    const isPast     = dateStr < today;

    const dayName = d.toLocaleDateString('tr-TR', { weekday: 'long' });
    const dayStr  = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const headerCls = isToday
        ? 'bg-indigo-600 text-white'
        : isPast
            ? 'bg-gray-100 text-gray-500'
            : 'bg-slate-50 text-gray-700';

    const cards = events.map(ev => buildEventCard(ev)).join('');

    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 ${headerCls}">
                <div>
                    <span class="font-semibold capitalize">${dayName}</span>
                    <span class="ml-2 text-sm opacity-80">${dayStr}</span>
                </div>
                ${isToday ? `<span class="text-xs font-bold uppercase tracking-wide opacity-90 bg-white text-indigo-600 px-2 py-0.5 rounded-full">Bugun</span>` : ''}
            </div>
            <div class="p-4 space-y-2">
                ${cards}
            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Etkinlik karti uretimi
// ---------------------------------------------------

function buildEventCard(ev) {
    if (ev.type === 'task') {
        return buildTaskCard(ev.data);
    }
    return buildVisitCard(ev.data);
}

function buildTaskCard(t) {
    const customer = t.customers
        ? escHtml(t.customers.company_name || `${t.customers.first_name} ${t.customers.last_name}`)
        : null;
    const assignee = t.assigned?.full_name ? escHtml(t.assigned.full_name) : null;

    const statusClass = {
        'Tamamlandi': 'cal-status-tamamlandi bg-green-50',
        'Bekliyor':   'cal-status-bekliyor bg-yellow-50',
        'Gecikti':    'cal-status-gecikti bg-red-50',
    }[t.status] || 'border-l-4 border-gray-300 bg-gray-50';

    return `
        <div class="${statusClass} rounded-lg px-4 py-3 flex items-start gap-3">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Gorev</span>
                    ${statusBadge(t.status)}
                    ${t.priority === 'Yuksek' ? `<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Yuksek Oncelik</span>` : ''}
                </div>
                <p class="font-medium text-gray-800 mt-1 text-sm">${escHtml(t.title)}</p>
                <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    ${customer ? `<span>${customer}</span>` : ''}
                    ${assignee ? `<span>Atanan: ${assignee}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function buildVisitCard(v) {
    const customer = v.customers
        ? escHtml(v.customers.company_name || `${v.customers.first_name} ${v.customers.last_name}`)
        : null;
    const assignee = v.assigned?.full_name ? escHtml(v.assigned.full_name) : null;

    const statusClass = v.status === 'Tamamlandi'
        ? 'cal-status-tamamlandi bg-green-50'
        : 'cal-status-planlandi bg-sky-50';

    return `
        <div class="${statusClass} rounded-lg px-4 py-3 flex items-start gap-3">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Ziyaret</span>
                    ${statusBadge(v.status)}
                    ${v.visit_time ? `<span class="text-xs text-gray-500">${v.visit_time.slice(0, 5)}</span>` : ''}
                </div>
                <p class="font-medium text-gray-800 mt-1 text-sm">${customer || '-'}</p>
                <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    ${v.purpose ? `<span>${escHtml(v.purpose)}</span>` : ''}
                    ${assignee ? `<span>Atanan: ${assignee}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}
