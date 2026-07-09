// ============================================================
// utils.js - Tüm moduller tarafindan kullanilan yardimci
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
        'Bekliyor':     'badge-pending',
        'Tamamlandı':   'badge-completed',
        'Gecikti':      'badge-urgent',
        'Acik':         'badge-open',
        'Devam Ediyor': 'badge-medium',
        'Çözüldü':      'badge-completed',
        'Cozuldu':      'badge-completed',
        'Kapali':       'badge-default',
        'Planlandı':    'badge-planned',
        'Planlandi':    'badge-planned',
    };
    // DB'deki ASCII değerleri kullanıcıya Türkçe göster
    const displayMap = {
        'Acik':         'Açık',
        'Cozuldu':      'Çözüldü',
        'Kapali':       'Kapalı',
        'Planlandi':    'Planlandı',
    };
    const cls = map[status] || 'badge-default';
    const label = displayMap[status] || status;
    return `<span class="badge-status ${cls}">${escHtml(label)}</span>`;
}

export function priorityBadge(priority) {
    const map = {
        'Acil':   'badge-urgent',
        'Yuksek': 'badge-high',
        'Orta':   'badge-medium',
        'Dusuk':  'badge-default',
    };
    const cls = map[priority] || 'badge-default';
    return `<span class="badge-status ${cls}">${escHtml(priority)}</span>`;
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
    autoInitSearchableSelects(el);
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
    if (msg.includes('violates foreign key')) return 'Bu kayıt baska kayitlarla iliskili oldugundan silinemez.';
    if (msg.includes('duplicate key')) return 'Bu deger zaten kullanilmaktadir.';
    if (msg.includes('violates row-level security')) return 'Bu islemi gerceklestirme yetkiniz yok.';
    if (msg.includes('not null')) return 'Zorunlu alanlar bos birakilamaz.';
    return msg;
}

// ---------------------------------------------------
// Fiyat formatlama
// ---------------------------------------------------

export function formatPrice(amount) {
    if (amount === null || amount === undefined) return '';
    return Number(amount).toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }) + '₺';
}

// ---------------------------------------------------
// Servis Tipi & Ücret Rozeti HTML Üretimi
// ---------------------------------------------------

/**
 * Destek kaydının servis_tipi, fiyat ve odeme_durumu
 * alanlarından şık bir rozet kombinasyonu üretir.
 *
 * Ücretsiz  → tek gri rozet
 * Ücretli   → amber rozet + fiyat etiketi + ödeme durumu rozeti
 */
export function getServiceBadgeHTML(s) {
    if (s.servis_tipi === 'Ucretli') {
        const priceStr = s.fiyat != null ? formatPrice(s.fiyat) : '';
        const feeBadge = s.odeme_durumu === 'Odendi'
            ? `<span class="badge-fee-paid">Ödendi</span>`
            : `<span class="badge-fee-unpaid">Ödenmedi</span>`;
        return `<span class="service-info-group">
            <span class="badge-service-paid">Ücretli</span>
            ${priceStr ? `<span class="service-price-tag">${priceStr}</span>` : ''}
            ${feeBadge}
        </span>`;
    }
    return `<span class="badge-service-free">Ücretsiz</span>`;
}

// ---------------------------------------------------
// Searchable Select Component
// ---------------------------------------------------

export function initSearchableSelect(selectEl) {
    if (!selectEl || selectEl.dataset.searchableInitialized) return;
    selectEl.dataset.searchableInitialized = 'true';

    // Hide original select
    selectEl.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select-wrapper relative w-full';
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    // Create trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'searchable-select-trigger w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'searchable-select-label truncate';
    trigger.appendChild(labelSpan);

    const arrowSvg = document.createElement('div');
    arrowSvg.innerHTML = `
        <svg class="w-4 h-4 text-gray-400 ml-2 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
    `;
    const svgEl = arrowSvg.firstElementChild;
    trigger.appendChild(svgEl);
    wrapper.appendChild(trigger);

    // Create dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown hidden absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-250 dark:border-slate-700 rounded-lg shadow-lg flex flex-col max-h-60 overflow-hidden';
    
    // Search Box
    const searchContainer = document.createElement('div');
    searchContainer.className = 'p-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Ara...';
    searchInput.className = 'searchable-select-search w-full px-3 py-1.5 border border-gray-300 dark:border-slate-650 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 dark:text-gray-300';
    searchContainer.appendChild(searchInput);
    dropdown.appendChild(searchContainer);

    // Options List Container
    const optionsList = document.createElement('ul');
    optionsList.className = 'searchable-select-options flex-1 overflow-y-auto py-1 text-sm text-gray-700 dark:text-gray-300 max-h-44';
    dropdown.appendChild(optionsList);
    wrapper.appendChild(dropdown);

    // Helper: update trigger label
    function updateTrigger() {
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        labelSpan.textContent = selectedOption ? selectedOption.textContent : '';
    }

    // Helper: rebuild options list
    function rebuildOptions() {
        optionsList.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            const li = document.createElement('li');
            li.className = 'px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/45 hover:text-indigo-600 dark:hover:text-indigo-200 cursor-pointer transition-colors truncate';
            li.textContent = opt.textContent;
            li.dataset.value = opt.value;
            if (opt.selected) {
                li.classList.add('bg-indigo-50/50', 'dark:bg-indigo-950/20', 'text-indigo-600', 'font-medium');
            }
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                updateTrigger();
                closeDropdown();
            });
            optionsList.appendChild(li);
        });
        updateTrigger();
    }

    // Open/Close logic
    function toggleDropdown() {
        if (dropdown.classList.contains('hidden')) {
            openDropdown();
        } else {
            closeDropdown();
        }
    }

    function openDropdown() {
        dropdown.classList.remove('hidden');
        svgEl.classList.add('rotate-180');
        searchInput.value = '';
        filterOptions('');
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeDropdown() {
        dropdown.classList.add('hidden');
        svgEl.classList.remove('rotate-180');
    }

    // Filter Options
    function filterOptions(query) {
        const normalizedQuery = query.toLowerCase()
            .replace(/i/g, 'i').replace(/ı/g, 'ı')
            .replace(/ş/g, 's').replace(/ğ/g, 'g')
            .replace(/ü/g, 'u').replace(/ö/g, 'o')
            .replace(/ç/g, 'c');
        const items = optionsList.querySelectorAll('li');
        items.forEach(item => {
            const text = item.textContent.toLowerCase()
                .replace(/i/g, 'i').replace(/ı/g, 'ı')
                .replace(/ş/g, 's').replace(/ğ/g, 'g')
                .replace(/ü/g, 'u').replace(/ö/g, 'o')
                .replace(/ç/g, 'c');
            if (text.includes(normalizedQuery)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Events
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
    });

    searchInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
    });

    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    // Intercept value changes
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(selectEl, 'value', {
        get() {
            return descriptor.get.call(this);
        },
        set(val) {
            descriptor.set.call(this, val);
            updateTrigger();
            const items = optionsList.querySelectorAll('li');
            items.forEach(item => {
                if (item.dataset.value === String(val)) {
                    item.classList.add('bg-indigo-50/50', 'dark:bg-indigo-950/20', 'text-indigo-600', 'font-medium');
                } else {
                    item.classList.remove('bg-indigo-50/50', 'dark:bg-indigo-950/20', 'text-indigo-600', 'font-medium');
                }
            });
        }
    });

    // MutationObserver to listen to option updates
    const observer = new MutationObserver(() => {
        rebuildOptions();
    });
    observer.observe(selectEl, { childList: true, subtree: true });

    // Initial build
    rebuildOptions();
}

export function autoInitSearchableSelects(container = document) {
    const selects = container.querySelectorAll('select');
    selects.forEach(select => {
        const hasPlaceholder = Array.from(select.options).some(opt => {
            const txt = opt.textContent.toLowerCase();
            return txt.includes('seçiniz') || txt.includes('seçin') || txt.includes('secin');
        });
        if (hasPlaceholder) {
            initSearchableSelect(select);
        }
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('reset', (e) => {
        setTimeout(() => {
            const selects = e.target.querySelectorAll('select[data-searchable-initialized="true"]');
            selects.forEach(select => {
                select.value = select.value;
            });
        }, 0);
    });
}

