import { supabase }    from '../supabase-config.js';
import { updatePassword } from '../auth.js';
import {
    setContent, showToast, escHtml, translateError, setPageTitle,
} from '../utils.js';

// ---------------------------------------------------
// Ana render
// ---------------------------------------------------

export async function renderSettings({ profile }) {
    setPageTitle('Ayarlar');

    setContent(buildHTML(profile));
    bindEvents(profile);
}

// ---------------------------------------------------
// HTML uretimi
// ---------------------------------------------------

function buildHTML(profile) {
    return `
        <div class="max-w-2xl mx-auto">

            <div class="mb-7">
                <h1 class="text-2xl font-bold text-gray-800">Ayarlar</h1>
                <p class="text-sm text-gray-500 mt-0.5">Profil bilgilerinizi ve guvenlik ayarlarinizi yonetin.</p>
            </div>

            <!-- Profil Bilgileri -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
                <div class="px-6 py-4 border-b border-gray-100">
                    <h2 class="text-base font-semibold text-gray-800">Profil Bilgileri</h2>
                </div>
                <form id="profile-form" novalidate class="px-6 py-5 space-y-4">

                    <div class="flex items-center gap-4 mb-2">
                        <div class="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold select-none">
                            ${escHtml(profile.full_name?.charAt(0)?.toUpperCase() || '?')}
                        </div>
                        <div>
                            <p class="font-semibold text-gray-800">${escHtml(profile.full_name)}</p>
                            <p class="text-sm text-gray-500">${escHtml(profile.email)}</p>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">${escHtml(profile.role)}</span>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                        <input type="text" name="full_name" value="${escHtml(profile.full_name)}" required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                        <input type="tel" name="phone" value="${escHtml(profile.phone)}"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                        <input type="email" value="${escHtml(profile.email)}" disabled
                            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed">
                        <p class="text-xs text-gray-400 mt-1">E-posta adresi degistirilemez.</p>
                    </div>

                    <div class="pt-2">
                        <button type="submit"
                            class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-colors disabled:opacity-60">
                            Profili Güncelle
                        </button>
                    </div>

                </form>
            </div>

            <!-- Sifre Degistirme -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div class="px-6 py-4 border-b border-gray-100">
                    <h2 class="text-base font-semibold text-gray-800">Sifre Degistir</h2>
                </div>
                <form id="password-form" novalidate class="px-6 py-5 space-y-4">

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Yeni Sifre <span class="text-red-500">*</span></label>
                        <input type="password" name="new_password" required minlength="8"
                            autocomplete="new-password"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="En az 8 karakter">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Yeni Sifre (Tekrar) <span class="text-red-500">*</span></label>
                        <input type="password" name="confirm_password" required
                            autocomplete="new-password"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Sifrenizi tekrar girin">
                    </div>

                    <div id="password-alert" class="hidden p-3 rounded-lg text-sm border"></div>

                    <div class="pt-2">
                        <button type="submit"
                            class="px-5 py-2 text-sm font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 transition-colors disabled:opacity-60">
                            Sifreyi Degistir
                        </button>
                    </div>

                </form>
            </div>

        </div>
    `;
}

// ---------------------------------------------------
// Olay baglama
// ---------------------------------------------------

function bindEvents(profile) {
    // Profil formu
    document.getElementById('profile-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const form      = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guncelleniyor...';

        const fd = new FormData(form);
        const payload = {
            full_name: fd.get('full_name')?.trim() || null,
            phone:     fd.get('phone')?.trim()     || null,
        };

        if (!payload.full_name) {
            showToast('Ad soyad zorunludur.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Profili Güncelle';
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', profile.id);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Profili Güncelle';

        if (error) {
            showToast(translateError(error), 'error');
            return;
        }

        showToast('Profil güncellendi.', 'success');
        // Profil nesnesini guncelle (global state guncellemez, sayfa yenilenmeli)
        profile.full_name = payload.full_name;
        profile.phone     = payload.phone;
        document.getElementById('nav-user-name').textContent = payload.full_name;
        document.getElementById('dd-name').textContent       = payload.full_name;
    });

    // Sifre formu
    document.getElementById('password-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const form      = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        const alertEl   = document.getElementById('password-alert');

        const fd          = new FormData(form);
        const newPass     = fd.get('new_password');
        const confirmPass = fd.get('confirm_password');

        function showPwAlert(msg, type) {
            const styles = {
                error:   'bg-red-50 border-red-300 text-red-800',
                success: 'bg-green-50 border-green-300 text-green-800',
            };
            alertEl.className = `p-3 rounded-lg text-sm border ${styles[type]}`;
            alertEl.textContent = msg;
            alertEl.classList.remove('hidden');
        }

        if (!newPass || newPass.length < 8) {
            showPwAlert('Sifre en az 8 karakter olmalidir.', 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showPwAlert('Sifreler eslesmiyor.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Degistiriliyor...';
        alertEl.classList.add('hidden');

        try {
            await updatePassword(newPass);
            showPwAlert('Sifreniz basariyla degistirildi.', 'success');
            form.reset();
        } catch (err) {
            showPwAlert(translateError(err), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sifreyi Degistir';
        }
    });
}
