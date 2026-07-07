import { supabase }    from '../supabase-config.js';
import { setContent, showToast, escHtml, formatDate, setPageTitle } from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderReports({ profile }) {
    setPageTitle('Raporlar');

    const today  = new Date().toISOString().split('T')[0];
    const month1 = new Date(); month1.setDate(1);
    const monthStart = month1.toISOString().split('T')[0];

    const [
        cTotal, cActive,
        tsOpen, tsClosed,
        tasksAll, tasksOverdue,
        licExpired,
        visitsMonth,
    ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('technical_supports').select('*', { count: 'exact', head: true }).in('status', ['Acik', 'Devam Ediyor']),
        supabase.from('technical_supports').select('*', { count: 'exact', head: true }).in('status', ['Çözüldü', 'Kapali']),
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'Gecikti'),
        supabase.from('licenses').select('*', { count: 'exact', head: true }).lt('maintenance_end', today),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('visit_date', monthStart),
    ]);

    // Personel bazli destek yukleri
    const { data: staffLoad } = await supabase
        .from('technical_supports')
        .select('assigned_to, profiles!technical_supports_assigned_to_fkey(full_name)')
        .in('status', ['Acik', 'Devam Ediyor'])
        .not('assigned_to', 'is', null);

    const loadMap = {};
    (staffLoad || []).forEach(s => {
        const name = s.profiles?.full_name || 'Bilinmiyor';
        loadMap[name] = (loadMap[name] || 0) + 1;
    });

    setContent(buildHTML({
        cTotal:      cTotal.count      || 0,
        cActive:     cActive.count     || 0,
        tsOpen:      tsOpen.count      || 0,
        tsClosed:    tsClosed.count    || 0,
        tasksAll:    tasksAll.count    || 0,
        tasksOverdue: tasksOverdue.count || 0,
        licExpired:  licExpired.count  || 0,
        visitsMonth: visitsMonth.count || 0,
        loadMap,
    }));
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(s) {
    const loadRows = Object.entries(s.loadMap).length
        ? Object.entries(s.loadMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => `
                <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span class="text-sm text-gray-700">${escHtml(name)}</span>
                    <div class="flex items-center gap-3">
                        <div class="w-32 bg-gray-200 rounded-full h-2">
                            <div class="bg-indigo-500 h-2 rounded-full" style="width: ${Math.min(100, count * 10)}%"></div>
                        </div>
                        <span class="text-sm font-semibold text-indigo-700 w-6 text-right">${count}</span>
                    </div>
                </div>
            `).join('')
        : '<p class="text-sm text-gray-400 py-3">Acik destek kaydı bulunmamaktadir.</p>';

    return `
        <div class="max-w-5xl mx-auto">

            <div class="mb-7">
                <h1 class="text-2xl font-bold text-gray-800">Raporlar</h1>
                <p class="text-sm text-gray-500 mt-0.5">Sistem geneli ozet istatistikleri</p>
            </div>

            <!-- Özet Kartlar -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${reportCard('Toplam Müşteri',        s.cTotal,       'text-gray-800')}
                ${reportCard('Aktif Müşteri',         s.cActive,      'text-indigo-600')}
                ${reportCard('Acik Destek',           s.tsOpen,       'text-orange-500')}
                ${reportCard('Cozulen Destek',        s.tsClosed,     'text-green-600')}
                ${reportCard('Toplam Görev',          s.tasksAll,     'text-gray-800')}
                ${reportCard('Geciken Görev',         s.tasksOverdue, 'text-red-600')}
                ${reportCard('Bakimi Gecmis Lisans',  s.licExpired,   'text-red-600')}
                ${reportCard('Bu Ay Ziyaret',         s.visitsMonth,  'text-blue-600')}
            </div>

            <!-- Personel Yukleme Ozeti -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
                <div class="px-5 py-4 border-b border-gray-100">
                    <h2 class="text-base font-semibold text-gray-800">Personel Destek Yukleri (Acik Kayitlar)</h2>
                </div>
                <div class="px-5 py-4">
                    ${loadRows}
                </div>
            </div>

            <!-- Bilgi notu -->
            <div class="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-700">
                Detayli raporlar ve CSV/Excel disa aktarimi bir sonraki surumde eklenecektir.
            </div>

        </div>
    `;
}

function reportCard(label, value, valueColor) {
    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p class="text-xs font-medium text-gray-500 mb-1">${label}</p>
            <p class="text-3xl font-bold ${valueColor}">${value}</p>
        </div>
    `;
}
