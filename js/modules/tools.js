// ============================================================
// tools.js - Araçlar, Programlar & Link Yönetimi (İndirme & Yükleme)
// ============================================================

import { supabase } from '../supabase-config.js';
import {
    setContent, showToast, escHtml, translateError, setPageTitle,
    openModal, closeModal, formatDate, formatDateTime
} from '../utils.js';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

let currentProfile = null;
let toolsState = [];
let activeCategory = 'all';
let searchQuery = '';

// Yükleme modu: 'folder' | 'file' | 'link'
let activeUploadMode = 'folder';
let selectedUploadFiles = []; // Array of File objects
let folderRootName = '';

/**
 * Dosya boyutunu insan tarafından okunabilir formata dönüştürür
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Dosya uzantısına veya türüne göre ikon ve renk stili üretir
 */
function getFileIconBadge(fileName, toolType = 'file') {
    if (toolType === 'link') {
        return {
            bg: 'bg-sky-100 dark:bg-sky-950/50',
            text: 'text-sky-600 dark:text-sky-400',
            border: 'border-sky-200 dark:border-sky-800',
            extBadge: 'WEB LİNK',
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>`
        };
    }

    const ext = (fileName || '').split('.').pop().toLowerCase();
    
    if (['exe', 'msi'].includes(ext)) {
        return {
            bg: 'bg-indigo-100 dark:bg-indigo-950/50',
            text: 'text-indigo-600 dark:text-indigo-400',
            border: 'border-indigo-200 dark:border-indigo-800',
            extBadge: 'EXE',
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
            </svg>`
        };
    } else if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) {
        return {
            bg: 'bg-amber-100 dark:bg-amber-950/50',
            text: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-200 dark:border-amber-800',
            extBadge: ext.toUpperCase(),
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>`
        };
    } else if (['ps1', 'bat', 'cmd', 'sh', 'py', 'vbs'].includes(ext)) {
        return {
            bg: 'bg-emerald-100 dark:bg-emerald-950/50',
            text: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-800',
            extBadge: ext.toUpperCase(),
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>`
        };
    } else if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
        return {
            bg: 'bg-blue-100 dark:bg-blue-950/50',
            text: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800',
            extBadge: ext.toUpperCase(),
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>`
        };
    } else {
        return {
            bg: 'bg-slate-100 dark:bg-slate-800',
            text: 'text-slate-600 dark:text-slate-400',
            border: 'border-slate-200 dark:border-slate-700',
            extBadge: ext.toUpperCase() || 'DOSYA',
            icon: `<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>`
        };
    }
}

// ---------------------------------------------------
// Ana Render Fonksiyonu
// ---------------------------------------------------
export async function renderTools({ profile }) {
    currentProfile = profile;
    setPageTitle('Araçlar & Programlar');

    // Şablon yapısını yükle
    setContent(buildBaseHTML());

    // Verileri çek ve listele
    await fetchAndRenderTools();

    // Etkinlikleri bağla
    bindEvents();
}

function buildBaseHTML() {
    return `
        <div class="max-w-7xl mx-auto space-y-6">

            <!-- Üst Başlık Kartı -->
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-3">
                        <div class="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-slate-800 dark:text-white">Araçlar, Programlar & Bağlantılar</h1>
                            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Yazıcı IP değiştirme, ayar programları, klasör paketleri ve web bağlantılarını yönetin.</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        id="btn-open-upload-modal"
                        type="button"
                        class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        Yeni Ekle (Dosya / Klasör / Link)
                    </button>
                </div>
            </div>

            <!-- Hızlı Komutlar (Komut Kopyalama Kartı) -->
            <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-800">
                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Hızlı PowerShell Komutu</span>
                            <span class="text-xs text-slate-400">Wolvox Check Kurulum Scripti</span>
                        </div>
                        <p class="text-xs text-slate-300">Terminal veya PowerShell yönetici modunda çalıştırabilirsiniz.</p>
                    </div>

                    <div class="w-full md:w-auto flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-2 font-mono text-xs">
                        <code class="text-indigo-300 truncate max-w-md select-all" id="quick-cmd-code">irm https://raw.githubusercontent.com/yunuscan/PosOtoKontrol/main/wolvox-check.ps1 | iex</code>
                        <button
                            id="btn-quick-copy"
                            type="button"
                            class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" id="quick-copy-icon">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                            <span>Kopyala</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filtreler & Arama Barı -->
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                
                <!-- Arama Kutusu -->
                <div class="relative w-full sm:w-80">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                    <input
                        type="text"
                        id="tools-search-input"
                        placeholder="Program adı, link veya açıklama ara..."
                        class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                </div>

                <!-- Kategori Butonları -->
                <div class="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0" id="category-filter-container">
                    <button type="button" data-category="all" class="category-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition-all">Tümü</button>
                    <button type="button" data-category="Yazıcı" class="category-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Yazıcı / IP</button>
                    <button type="button" data-category="Ağ" class="category-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Ağ Araçları</button>
                    <button type="button" data-category="Yazılım" class="category-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Yazılım & Kurulum</button>
                    <button type="button" data-category="Teşhis" class="category-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Teşhis & Kontrol</button>
                    <button type="button" data-category="Genel" class="category-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Diğer</button>
                </div>
            </div>

            <!-- Program Dosyaları & Linkler Izgarası -->
            <div id="tools-grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div class="col-span-full text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Araçlar ve bağlantılar yükleniyor...</p>
                </div>
            </div>

        </div>

        <!-- ============================================================
             YENİ DOSYA / KLASÖR / LİNK EKLENME MODALI
             ============================================================ -->
        <div id="modal-upload-tool" class="hidden fixed inset-0 z-50 overflow-y-auto modal-overlay flex items-center justify-center p-4">
            <div class="relative bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 transform transition-all">
                
                <!-- Modal Başlığı -->
                <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                    <div class="flex items-center gap-2.5">
                        <div class="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white">Yeni Araç, Program veya Link Ekle</h3>
                    </div>
                    <button type="button" id="btn-close-upload-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Yükleme Formu -->
                <form id="form-upload-tool" class="space-y-4" novalidate>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Başlık / Araç Adı <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="upload-program-name"
                            required
                            placeholder="Örn: Yazıcı IP Değiştirme Programı veya Sürücü İndirme Bağlantısı"
                            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                        <select
                            name="category"
                            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Yazıcı">Yazıcı / IP Değiştirme</option>
                            <option value="Ağ">Ağ Araçları</option>
                            <option value="Yazılım">Yazılım & Kurulum</option>
                            <option value="Teşhis">Teşhis & Kontrol</option>
                            <option value="Genel" selected>Genel / Diğer</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Açıklama</label>
                        <textarea
                            name="description"
                            rows="2"
                            placeholder="Program, klasör içeriği veya bağlantı hakkında notlar..."
                            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        ></textarea>
                    </div>

                    <!-- Yükleme Modu Seçeneği: Klasör vs Tek Dosya vs Web Linki -->
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Ekleme Türü</label>
                        <div class="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                id="btn-mode-folder"
                                class="px-2 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition-all"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                </svg>
                                Klasör (ZIP)
                            </button>
                            <button
                                type="button"
                                id="btn-mode-file"
                                class="px-2 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1 transition-all"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                </svg>
                                Tek Dosya
                            </button>
                            <button
                                type="button"
                                id="btn-mode-link"
                                class="px-2 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1 transition-all"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                </svg>
                                Web Linki
                            </button>
                        </div>
                    </div>

                    <!-- Drag & Drop / Input Alanı (Dosya/Klasör İçin) -->
                    <div id="dropzone-container">
                        <div
                            id="upload-dropzone"
                            class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-5 text-center bg-slate-50 dark:bg-slate-900/60 transition-colors cursor-pointer relative"
                        >
                            <!-- Hidden Inputs -->
                            <input
                                type="file"
                                id="tool-folder-input"
                                webkitdirectory
                                directory
                                multiple
                                class="hidden"
                            >
                            <input
                                type="file"
                                id="tool-file-input"
                                class="hidden"
                            >

                            <div id="dropzone-empty-state" class="space-y-2">
                                <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200" id="dropzone-title-text">
                                        Seçmek veya Sürükleyip Bırakmak İçin Tıklayın
                                    </p>
                                    <p class="text-[11px] text-slate-400 mt-0.5" id="dropzone-subtitle-text">
                                        Tüm klasör içeriği veya tek dosya seçebilirsiniz.
                                    </p>
                                </div>
                            </div>

                            <!-- Selected Summary State -->
                            <div id="dropzone-selected-state" class="hidden p-2 bg-indigo-50/80 dark:bg-indigo-950/80 rounded-lg border border-indigo-200 dark:border-indigo-800 text-left flex items-center justify-between">
                                <div class="flex items-center gap-2.5 truncate pr-2">
                                    <div class="p-2 bg-indigo-600 text-white rounded-lg shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                        </svg>
                                    </div>
                                    <div class="truncate">
                                        <p class="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate" id="selected-file-name">ProgramKlasoru</p>
                                        <p class="text-[10px] text-indigo-600 dark:text-indigo-400" id="selected-file-info">32 dosya • ~14.2 MB</p>
                                    </div>
                                </div>
                                <button type="button" id="btn-clear-selected-files" class="p-1 text-indigo-400 hover:text-red-600 transition-colors">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Web Linki Giriş Alanı (Harici Link Modu İçin) -->
                    <div id="link-input-container" class="hidden">
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Harici Bağlantı (URL / Web Adresi) <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="url"
                            name="external_url"
                            id="upload-external-url"
                            placeholder="https://example.com/yazici-ip-degistirme veya web adresi"
                            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                        <p class="text-[11px] text-slate-400 mt-1">Sık kullanılan sürücü indirme adresi veya çevrimiçi web aracını ekleyebilirsiniz.</p>
                    </div>

                    <!-- Yükleme Durumu Uyarısı / İlerleme Çubuğu -->
                    <div id="upload-status-box" class="hidden p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-2">
                        <div class="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                            <span id="upload-status-text">Klasör paketleniyor...</span>
                            <span id="upload-progress-percent">0%</span>
                        </div>
                        <div class="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                            <div id="upload-progress-bar" class="h-full bg-indigo-600 rounded-full transition-all duration-200" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                        <button
                            type="button"
                            id="btn-cancel-upload"
                            class="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            id="btn-submit-upload"
                            class="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                        >
                            Kaydet
                        </button>
                    </div>
                </form>

            </div>
        </div>
    `;
}

// ---------------------------------------------------
// Veri Çekme ve Liste Oluşturma
// ---------------------------------------------------
async function fetchAndRenderTools() {
    try {
        const { data, error } = await supabase
            .from('tools')
            .select('*, profiles:created_by(full_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        toolsState = data || [];
        renderToolsGrid();

        // Sayfa dışındaki diğer yerlerde (ör. topbar dropdown) yenileme tetikle
        window.dispatchEvent(new CustomEvent('tools-updated'));
    } catch (err) {
        console.error('[Fetch Tools Error]', err);
        showToast('Araçlar yüklenirken bir hata oluştu: ' + translateError(err), 'error');
        const container = document.getElementById('tools-grid-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full p-8 text-center bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800">
                    <p class="text-sm font-semibold text-red-600 dark:text-red-400">Veriler yüklenemedi.</p>
                    <p class="text-xs text-red-500 mt-1">${escHtml(err.message || String(err))}</p>
                </div>
            `;
        }
    }
}

function renderToolsGrid() {
    const container = document.getElementById('tools-grid-container');
    if (!container) return;

    // Filtreleme
    const filtered = toolsState.filter(item => {
        const matchCategory = activeCategory === 'all' || item.category === activeCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q || 
            (item.name || '').toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q) ||
            (item.file_name || '').toLowerCase().includes(q) ||
            (item.external_url || '').toLowerCase().includes(q);
        return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-white">Henüz Program veya Link Eklenmedi</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    ${searchQuery || activeCategory !== 'all' ? 'Arama kriterlerinize uygun araç bulunamadı.' : 'Yazıcı IP değiştirme programı, klasör paketleri veya web linklerini "+ Yeni Ekle" butonuyla kaydedebilirsiniz.'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isLink = item.tool_type === 'link';
        const badge = getFileIconBadge(item.file_name, item.tool_type);
        const creatorName = item.profiles?.full_name || 'Sistem';
        const formattedSize = isLink ? 'Harici Link' : formatFileSize(item.file_size);
        const canDelete = currentProfile?.role === 'Yönetici' || currentProfile?.role === 'Yonetici' || currentProfile?.role === 'Teknik Servis' || item.created_by === currentProfile?.id;
        const isZip = !isLink && (item.file_name?.endsWith('.zip') || item.file_name?.endsWith('.rar'));

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                
                <div>
                    <!-- Üst Bölüm: İkon, Kategori ve Uzantı -->
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="p-3 rounded-xl ${badge.bg} ${badge.text} ${badge.border} border shadow-xs">
                                ${badge.icon}
                            </div>
                            <div>
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    ${escHtml(item.category || 'Genel')}
                                </span>
                                <h3 class="text-base font-bold text-slate-800 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                                    ${escHtml(item.name)}
                                </h3>
                            </div>
                        </div>

                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isLink ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200' : (isZip ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200' : 'bg-slate-100 dark:bg-slate-900 text-slate-500')} border border-slate-200 dark:border-slate-700">
                            ${isLink ? 'HARİCİ LİNK' : (isZip ? 'KLASÖR (ZIP)' : badge.extBadge)}
                        </span>
                    </div>

                    <!-- Açıklama -->
                    <p class="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                        ${escHtml(item.description || (isLink ? item.external_url : 'Açıklama belirtilmemiş.'))}
                    </p>
                </div>

                <div>
                    <!-- Bilgi Çubuğu (Boyut, Tıklanma Sayısı, Yükleyen) -->
                    <div class="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-400 mb-4">
                        <div class="flex items-center gap-2">
                            <span class="font-medium text-slate-600 dark:text-slate-300">${formattedSize}</span>
                            <span>•</span>
                            <span class="flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                                ${item.download_count || 0} ${isLink ? 'tıklanma' : 'indirme'}
                            </span>
                        </div>
                        <span class="truncate max-w-[120px]" title="${escHtml(creatorName)}">${escHtml(creatorName)}</span>
                    </div>

                    <!-- Butonlar -->
                    <div class="flex items-center gap-2">
                        ${isLink ? `
                            <a
                                href="${escHtml(item.external_url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-action="open-link"
                                data-id="${item.id}"
                                class="flex-1 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:hover:bg-sky-900 dark:text-sky-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                                Bağlantıyı Aç
                            </a>
                        ` : `
                            <button
                                type="button"
                                data-action="download"
                                data-id="${item.id}"
                                class="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                </svg>
                                ${isZip ? 'Klasörü İndir (ZIP)' : 'İndir'}
                            </button>
                        `}

                        ${canDelete ? `
                            <button
                                type="button"
                                data-action="delete"
                                data-id="${item.id}"
                                class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                                title="Sil"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>

            </div>
        `;
    }).join('');
}

// ---------------------------------------------------
// Etkinlik Bağlantıları (Event Listeners)
// ---------------------------------------------------
function bindEvents() {
    // 1. Modal Aç / Kapat
    const openBtn = document.getElementById('btn-open-upload-modal');
    const closeBtn = document.getElementById('btn-close-upload-modal');
    const cancelBtn = document.getElementById('btn-cancel-upload');

    if (openBtn) openBtn.addEventListener('click', () => {
        resetUploadModalForm();
        openModal('modal-upload-tool');
    });
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-upload-tool'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-upload-tool'));

    // 2. Mod Değiştirme (Klasör vs Tek Dosya vs Link)
    const btnFolderMode = document.getElementById('btn-mode-folder');
    const btnFileMode = document.getElementById('btn-mode-file');
    const btnLinkMode = document.getElementById('btn-mode-link');

    if (btnFolderMode && btnFileMode && btnLinkMode) {
        btnFolderMode.addEventListener('click', () => setUploadMode('folder'));
        btnFileMode.addEventListener('click', () => setUploadMode('file'));
        btnLinkMode.addEventListener('click', () => setUploadMode('link'));
    }

    // Default: Klasör Yükleme Modu
    setUploadMode('folder');

    // 3. Dropzone Tıklama ve Seçim
    const dropzone = document.getElementById('upload-dropzone');
    const folderInput = document.getElementById('tool-folder-input');
    const fileInput = document.getElementById('tool-file-input');
    const clearFilesBtn = document.getElementById('btn-clear-selected-files');

    if (dropzone) {
        dropzone.addEventListener('click', e => {
            if (e.target.closest('#btn-clear-selected-files')) return;
            if (activeUploadMode === 'folder') {
                folderInput.click();
            } else if (activeUploadMode === 'file') {
                fileInput.click();
            }
        });

        // Drag & Drop
        dropzone.addEventListener('dragover', e => {
            e.preventDefault();
            dropzone.classList.add('border-indigo-600', 'bg-indigo-50/50');
        });

        dropzone.addEventListener('dragleave', e => {
            e.preventDefault();
            dropzone.classList.remove('border-indigo-600', 'bg-indigo-50/50');
        });

        dropzone.addEventListener('drop', async e => {
            e.preventDefault();
            dropzone.classList.remove('border-indigo-600', 'bg-indigo-50/50');

            if (activeUploadMode === 'link') return;

            const items = e.dataTransfer?.items;
            if (items && items.length > 0) {
                const files = await getFilesFromDroppedItems(items);
                if (files.length > 0) {
                    handleFilesSelected(files);
                }
            }
        });
    }

    if (folderInput) {
        folderInput.addEventListener('change', e => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                handleFilesSelected(files);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', e => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
                handleFilesSelected(files);
            }
        });
    }

    if (clearFilesBtn) {
        clearFilesBtn.addEventListener('click', e => {
            e.stopPropagation();
            resetSelectedFiles();
        });
    }

    // 4. Hızlı Komut Kopyalama
    const copyCmdBtn = document.getElementById('btn-quick-copy');
    if (copyCmdBtn) {
        copyCmdBtn.addEventListener('click', async () => {
            const cmdText = document.getElementById('quick-cmd-code')?.textContent || '';
            try {
                await navigator.clipboard.writeText(cmdText);
                showToast('PowerShell komutu panoya kopyalandı.', 'success');
            } catch {
                showToast('Kopyalama başarısız oldu.', 'error');
            }
        });
    }

    // 5. Arama Filtresi
    const searchInput = document.getElementById('tools-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchQuery = e.target.value;
            renderToolsGrid();
        });
    }

    // 6. Kategori Filtre Butonları
    const categoryContainer = document.getElementById('category-filter-container');
    if (categoryContainer) {
        categoryContainer.addEventListener('click', e => {
            const btn = e.target.closest('.category-btn');
            if (!btn) return;

            activeCategory = btn.dataset.category || 'all';

            // Buton stillerini güncelle
            categoryContainer.querySelectorAll('.category-btn').forEach(b => {
                b.classList.remove('bg-indigo-600', 'text-white');
                b.classList.add('text-slate-600', 'dark:text-slate-300');
            });
            btn.classList.remove('text-slate-600', 'dark:text-slate-300');
            btn.classList.add('bg-indigo-600', 'text-white');

            renderToolsGrid();
        });
    }

    // 7. Yükleme Formu Gönderimi
    const uploadForm = document.getElementById('form-upload-tool');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleToolUpload);
    }

    // 8. Grid Buton Etkinlikleri (İndir / Link Aç / Sil)
    const gridContainer = document.getElementById('tools-grid-container');
    if (gridContainer) {
        gridContainer.addEventListener('click', async e => {
            const downloadBtn = e.target.closest('[data-action="download"]');
            const openLinkBtn = e.target.closest('[data-action="open-link"]');
            const deleteBtn = e.target.closest('[data-action="delete"]');

            if (downloadBtn) {
                const toolId = downloadBtn.dataset.id;
                await handleToolDownload(toolId);
            } else if (openLinkBtn) {
                const toolId = openLinkBtn.dataset.id;
                await handleIncrementCount(toolId);
            } else if (deleteBtn) {
                const toolId = deleteBtn.dataset.id;
                await handleToolDelete(toolId);
            }
        });
    }
}

// ---------------------------------------------------
// Yükleme Modunu Değiştirme ('folder' | 'file' | 'link')
// ---------------------------------------------------
function setUploadMode(mode) {
    activeUploadMode = mode;
    const btnFolder = document.getElementById('btn-mode-folder');
    const btnFile = document.getElementById('btn-mode-file');
    const btnLink = document.getElementById('btn-mode-link');

    const dropzoneContainer = document.getElementById('dropzone-container');
    const linkInputContainer = document.getElementById('link-input-container');

    const titleText = document.getElementById('dropzone-title-text');
    const subtitleText = document.getElementById('dropzone-subtitle-text');

    // Buton Stilleri
    [btnFolder, btnFile, btnLink].forEach(b => {
        if (!b) return;
        b.classList.remove('bg-white', 'dark:bg-slate-800', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm', 'border');
        b.classList.add('text-slate-600', 'dark:text-slate-400');
    });

    const activeBtn = mode === 'folder' ? btnFolder : (mode === 'file' ? btnFile : btnLink);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'dark:bg-slate-800', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm', 'border');
        activeBtn.classList.remove('text-slate-600', 'dark:text-slate-400');
    }

    if (mode === 'link') {
        if (dropzoneContainer) dropzoneContainer.classList.add('hidden');
        if (linkInputContainer) linkInputContainer.classList.remove('hidden');
    } else {
        if (dropzoneContainer) dropzoneContainer.classList.remove('hidden');
        if (linkInputContainer) linkInputContainer.classList.add('hidden');

        if (mode === 'folder') {
            if (titleText) titleText.textContent = 'Klasör Seçmek veya Sürüklemek İçin Tıklayın';
            if (subtitleText) subtitleText.textContent = 'Klasördeki tüm alt dosyalar otomatik olarak ZIP paketine dönüştürülür.';
        } else {
            if (titleText) titleText.textContent = 'Dosya Seçmek veya Sürüklemek İçin Tıklayın';
            if (subtitleText) subtitleText.textContent = '.exe, .zip, .msi, .ps1 veya dilediğiniz tek dosyayı yükleyin.';
        }
    }
}

// ---------------------------------------------------
// Dosya / Klasör Seçimini İşleme
// ---------------------------------------------------
function handleFilesSelected(files) {
    selectedUploadFiles = files;
    if (files.length === 0) return;

    const emptyState = document.getElementById('dropzone-empty-state');
    const selectedState = document.getElementById('dropzone-selected-state');
    const nameEl = document.getElementById('selected-file-name');
    const infoEl = document.getElementById('selected-file-info');
    const programNameInput = document.getElementById('upload-program-name');

    let totalSize = 0;
    files.forEach(f => totalSize += f.size);

    if (files.length > 1 || files[0].webkitRelativePath) {
        // Klasör seçildi
        const firstPath = files[0].webkitRelativePath || files[0].name;
        folderRootName = firstPath.split('/')[0] || 'Klasor';
        
        if (nameEl) nameEl.textContent = `📁 ${folderRootName}`;
        if (infoEl) infoEl.textContent = `${files.length} dosya • ~${formatFileSize(totalSize)} (ZIP yapılacaktır)`;

        // Eğer program adı girilmediyse klasör adını doldur
        if (programNameInput && !programNameInput.value) {
            programNameInput.value = folderRootName;
        }
    } else {
        // Tek dosya seçildi
        const file = files[0];
        folderRootName = file.name;
        
        if (nameEl) nameEl.textContent = `📄 ${file.name}`;
        if (infoEl) infoEl.textContent = formatFileSize(file.size);

        if (programNameInput && !programNameInput.value) {
            programNameInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (selectedState) selectedState.classList.remove('hidden');
}

function resetSelectedFiles() {
    selectedUploadFiles = [];
    folderRootName = '';
    const emptyState = document.getElementById('dropzone-empty-state');
    const selectedState = document.getElementById('dropzone-selected-state');
    const folderInput = document.getElementById('tool-folder-input');
    const fileInput = document.getElementById('tool-file-input');

    if (folderInput) folderInput.value = '';
    if (fileInput) fileInput.value = '';

    if (emptyState) emptyState.classList.remove('hidden');
    if (selectedState) selectedState.classList.add('hidden');
}

function resetUploadModalForm() {
    const form = document.getElementById('form-upload-tool');
    if (form) form.reset();
    resetSelectedFiles();
    setUploadMode('folder');
    const statusBox = document.getElementById('upload-status-box');
    if (statusBox) statusBox.classList.add('hidden');
}

// Drag and drop klasör okuma
async function getFilesFromDroppedItems(dataTransferItems) {
    const files = [];
    const entries = [];

    for (let i = 0; i < dataTransferItems.length; i++) {
        const item = dataTransferItems[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) entries.push(entry);
        }
    }

    async function traverseEntry(entry, path = '') {
        if (entry.isFile) {
            return new Promise(resolve => {
                entry.file(file => {
                    Object.defineProperty(file, 'webkitRelativePath', {
                        value: path + file.name,
                        writable: false
                    });
                    files.push(file);
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const readEntries = () => new Promise(resolve => {
                dirReader.readEntries(async entriesInDir => {
                    if (!entriesInDir || entriesInDir.length === 0) {
                        resolve();
                    } else {
                        for (const childEntry of entriesInDir) {
                            await traverseEntry(childEntry, path + entry.name + '/');
                        }
                        await readEntries();
                        resolve();
                    }
                });
            });
            await readEntries();
        }
    }

    for (const entry of entries) {
        await traverseEntry(entry, '');
    }

    return files;
}

// ---------------------------------------------------
// Dosya, Klasör veya Link Kaydetme İşlemi
// ---------------------------------------------------
async function handleToolUpload(e) {
    e.preventDefault();
    const form = e.target;

    const name = form.name.value.trim();
    const category = form.category.value;
    const description = form.description.value.trim();

    if (!name) {
        showToast('Lütfen başlık / araç adını girin.', 'warning');
        return;
    }

    const statusBox = document.getElementById('upload-status-box');
    const statusText = document.getElementById('upload-status-text');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-progress-percent');
    const submitBtn = document.getElementById('btn-submit-upload');

    function updateProgress(percent, message) {
        if (statusText) statusText.textContent = message;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
    }

    try {
        if (statusBox) statusBox.classList.remove('hidden');
        if (submitBtn) submitBtn.disabled = true;

        // 1. Harici Link Ekleme Modu
        if (activeUploadMode === 'link') {
            const externalUrl = form.external_url.value.trim();
            if (!externalUrl) {
                showToast('Lütfen harici web bağlantı URL adresini girin.', 'warning');
                return;
            }

            updateProgress(50, 'Web bağlantısı kaydediliyor...');

            const { error: dbError } = await supabase.from('tools').insert([{
                name,
                category,
                description,
                tool_type: 'link',
                external_url: externalUrl,
                created_by: currentProfile?.id || null
            }]);

            if (dbError) throw dbError;

            updateProgress(100, 'Bağlantı başarıyla eklendi!');
            showToast('Web bağlantısı başarıyla eklendi.', 'success');

        } else {
            // 2. Dosya veya Klasör Yükleme Modu
            if (selectedUploadFiles.length === 0) {
                showToast('Lütfen yüklemek için bir dosya veya klasör seçin.', 'warning');
                return;
            }

            let finalUploadFile = null;
            let finalFileName = '';

            if (selectedUploadFiles.length > 1 || (selectedUploadFiles[0] && selectedUploadFiles[0].webkitRelativePath && selectedUploadFiles[0].webkitRelativePath.includes('/'))) {
                updateProgress(5, 'Klasör içerikleri taranıyor ve ZIP paketi hazırlanıyor...');

                const zip = new JSZip();
                const totalFiles = selectedUploadFiles.length;

                for (let i = 0; i < totalFiles; i++) {
                    const file = selectedUploadFiles[i];
                    const relPath = file.webkitRelativePath || file.name;
                    zip.file(relPath, file);

                    if (i % 10 === 0 || i === totalFiles - 1) {
                        const currentPercent = Math.round(((i + 1) / totalFiles) * 35);
                        updateProgress(currentPercent, `Klasör dosyaları ekleniyor (${i + 1}/${totalFiles})...`);
                    }
                }

                updateProgress(40, 'ZIP arşivi oluşturuluyor...');
                const zippedBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                }, metadata => {
                    const p = 40 + Math.round((metadata.percent / 100) * 40);
                    updateProgress(p, `ZIP arşivi oluşturuluyor: %${Math.round(metadata.percent)}...`);
                });

                const zipName = `${folderRootName || name || 'program'}.zip`;
                finalUploadFile = new File([zippedBlob], zipName, { type: 'application/zip' });
                finalFileName = zipName;

            } else {
                finalUploadFile = selectedUploadFiles[0];
                finalFileName = finalUploadFile.name;
            }

            updateProgress(85, 'Supabase Storage sunucusuna aktarılıyor...');

            const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `programs/${Date.now()}_${sanitizedFileName}`;

            const { data: storageData, error: storageError } = await supabase.storage
                .from('tools')
                .upload(filePath, finalUploadFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (storageError) throw storageError;

            updateProgress(95, 'Veritabanı kaydı oluşturuluyor...');

            const { error: dbError } = await supabase.from('tools').insert([{
                name,
                category,
                description,
                tool_type: 'file',
                file_name: finalFileName,
                file_path: filePath,
                file_size: finalUploadFile.size,
                mime_type: finalUploadFile.type || 'application/octet-stream',
                created_by: currentProfile?.id || null
            }]);

            if (dbError) throw dbError;

            updateProgress(100, 'Tamamlandı!');
            showToast('Program / Klasör başarıyla yüklendi.', 'success');
        }

        resetUploadModalForm();
        closeModal('modal-upload-tool');
        await fetchAndRenderTools();

    } catch (err) {
        console.error('[Upload Error]', err);
        showToast('Yükleme hatası: ' + translateError(err), 'error');
    } finally {
        if (statusBox) statusBox.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ---------------------------------------------------
// Dosya / Klasör İndirme İşlemi (Exported Helper)
// ---------------------------------------------------
export async function downloadToolFile(item) {
    if (!item || !item.file_path) return;

    try {
        showToast(`"${item.name}" indirmesi başlatılıyor...`, 'info');

        const { data } = supabase.storage
            .from('tools')
            .getPublicUrl(item.file_path);

        if (!data || !data.publicUrl) {
            throw new Error('İndirme bağlantısı alınamadı.');
        }

        const a = document.createElement('a');
        a.href = data.publicUrl;
        a.download = item.file_name || 'dosya';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await handleIncrementCount(item.id);

    } catch (err) {
        console.error('[Download Error]', err);
        showToast('İndirme başarısız oldu: ' + translateError(err), 'error');
    }
}

async function handleToolDownload(toolId) {
    const item = toolsState.find(t => t.id === toolId);
    if (item) {
        await downloadToolFile(item);
    }
}

// İndirme / Tıklanma Sayacını Artırma
export async function handleIncrementCount(toolId) {
    try {
        const item = toolsState.find(t => t.id === toolId);
        const newCount = ((item ? item.download_count : 0) || 0) + 1;
        
        if (item) {
            item.download_count = newCount;
            renderToolsGrid();
        }

        await supabase
            .from('tools')
            .update({ download_count: newCount })
            .eq('id', toolId);
    } catch (err) {
        console.error('[Increment Count Error]', err);
    }
}

// ---------------------------------------------------
// Kayıt Silme İşlemi
// ---------------------------------------------------
async function handleToolDelete(toolId) {
    const item = toolsState.find(t => t.id === toolId);
    if (!item) return;

    if (!confirm(`"${item.name}" kaydını silmek istediğinizden emin misiniz?`)) {
        return;
    }

    try {
        // Storage'dan sil (Eğer dosya ise)
        if (item.tool_type === 'file' && item.file_path) {
            await supabase.storage.from('tools').remove([item.file_path]);
        }

        // Veritabanından sil
        const { error } = await supabase
            .from('tools')
            .delete()
            .eq('id', item.id);

        if (error) throw error;

        showToast('Kayıt başarıyla silindi.', 'success');
        await fetchAndRenderTools();

    } catch (err) {
        console.error('[Delete Error]', err);
        showToast('Silme hatası: ' + translateError(err), 'error');
    }
}
