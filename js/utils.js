// ============================================================
// utils.js - Tum moduller tarafindan kullanilan yardimci
// fonksiyonlar. Dairesel bagimliliktan kacınmak icin app.js
// disinda tutulur.
// ============================================================

// ---------------------------------------------------
// DOM icerik yonetimi
// ---------------------------------------------------

export function setContent(html) {
    const area = document.getElementById('content-area');
    if (!area) return;
    area.innerHTML = html;
    // Dinamik icerikte Flowbite bilesenlerini yeniden baslatir
    if (typeof window.initFlowbite === 'function') {
        window.initFlowbite();
    }
}

export function showLoading() {
    const area = document.getElementById('content-area');
    if (area) {
        area.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        `;
    }
}

// ---------------------------------------------------
// Bildirimler (Toast)
// ---------------------------------------------------

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const palette = {
        success: 'bg-green-50 border-green-300 text-green-800',
        error:   'bg-red-50 border-red-300 text-red-800',
        warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
        info:    'bg-blue-50 border-blue-300 text-blue-800',
    };

    const el = document.createElement('div');
    el.className = `flex items-start gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-md transition-opacity duration-300 ${palette[type] || palette.info}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 4500);
}

// ---------------------------------------------------
// XSS koruması
// ---------------------------------------------------

export function escHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------------------------------------------------
// Tarih formatlama
// ---------------------------------------------------

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d)) return isoStr;
    return d.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// Bugun mi kontrol
export function isToday(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + 'T00:00:00').toDateString() === new Date().toDateString();
}

// Gecmis tarih mi kontrol
export function isPast(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}

// ---------------------------------------------------
// Rozet (badge) HTML uretimi
// ---------------------------------------------------

export function statusBadge(status) {
    const map = {
        'Bekliyor':     'bg-yellow-100 text-yellow-800',
        'Tamamlandi':   'bg-green-100 text-green-800',
        'Gecikti':      'bg-red-100 text-red-800',
        'Acik':         'bg-blue-100 text-blue-800',
        'Devam Ediyor': 'bg-orange-100 text-orange-800',
        'Cozuldu':      'bg-green-100 text-green-800',
        'Kapali':       'bg-gray-100 text-gray-600',
        'Planlandi':    'bg-sky-100 text-sky-800',
    };
    const cls = map[status] || 'bg-gray-100 text-gray-600';
    return `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${cls}">${escHtml(status)}</span>`;
}

export function priorityBadge(priority) {
    const map = {
        'Yuksek': 'bg-red-100 text-red-800',
        'Orta':   'bg-yellow-100 text-yellow-800',
        'Dusuk':  'bg-slate-100 text-slate-700',
    };
    const cls = map[priority] || 'bg-gray-100 text-gray-700';
    return `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${cls}">${escHtml(priority)}</span>`;
}

// ---------------------------------------------------
// Modal yonetimi (hafif, CSS tabanli)
// ---------------------------------------------------

export function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
}

export function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
}

// ---------------------------------------------------
// Select secenekleri uretimi
// ---------------------------------------------------

export function buildOptions(items, valueKey, labelFn, selectedValue = null) {
    return items.map(item => {
        const val   = item[valueKey];
        const label = typeof labelFn === 'function' ? labelFn(item) : item[labelFn];
        const sel   = val === selectedValue ? 'selected' : '';
        return `<option value="${escHtml(String(val))}" ${sel}>${escHtml(label)}</option>`;
    }).join('');
}

// ---------------------------------------------------
// Sayfa basligini guncelle
// ---------------------------------------------------

export function setPageTitle(title) {
    document.title = title ? `${title} - TeknikCRM` : 'TeknikCRM';
}

// ---------------------------------------------------
// Supabase hata mesajlarini Turkce'ye cevir
// ---------------------------------------------------

export function translateError(err) {
    if (!err) return 'Bilinmeyen hata.';
    const msg = err.message || String(err);
    if (msg.includes('violates foreign key')) return 'Bu kayit baska kayitlarla iliskili oldugundan silinemez.';
    if (msg.includes('duplicate key')) return 'Bu deger zaten kullanilmaktadir.';
    if (msg.includes('violates row-level security')) return 'Bu islemi gerceklestirme yetkiniz yok.';
    if (msg.includes('not null')) return 'Zorunlu alanlar bos birakilamaz.';
    return msg;
}
