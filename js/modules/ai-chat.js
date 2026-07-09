/**
 * TeknikCRM - AI Asistan Chat Modülü
 * Sağ üstteki "AI Asistan" butonuna tıklanınca chat paneli açılır,
 * /api/ai-chat endpoint'i üzerinden Gemini'ye istek gönderilir.
 */

const panel    = document.getElementById('ai-chat-panel');
const backdrop = document.getElementById('ai-chat-backdrop');
const messages = document.getElementById('ai-chat-messages');
const input    = document.getElementById('ai-chat-input');
const sendBtn  = document.getElementById('btn-ai-chat-send');

// ----------------------------------------------------------------
// Panel aç / kapat
// ----------------------------------------------------------------

function openChat() {
    panel.style.transform    = 'translateX(0)';
    backdrop.classList.remove('hidden');
    input.focus();
}

function closeChat() {
    panel.style.transform = 'translateX(100%)';
    backdrop.classList.add('hidden');
}

document.getElementById('btn-ai-chat')?.addEventListener('click', openChat);
document.getElementById('btn-ai-chat-close')?.addEventListener('click', closeChat);
backdrop.addEventListener('click', closeChat);

// ESC ile kapat
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.style.transform === 'translateX(0px)') {
        closeChat();
    }
});

// ----------------------------------------------------------------
// Hızlı sorular
// ----------------------------------------------------------------

document.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        input.value = btn.textContent.trim();
        sendMessage();
    });
});

// ----------------------------------------------------------------
// Enter ile gönder (Shift+Enter yeni satır)
// ----------------------------------------------------------------

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Textarea otomatik yükseklik
input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 128) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

// ----------------------------------------------------------------
// Mesaj gönderme mantığı
// ----------------------------------------------------------------

async function sendMessage() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    // Kullanıcı mesajını ekle
    appendMessage('user', text);
    input.value = '';
    input.style.height = 'auto';

    // Yükleme durumu
    sendBtn.disabled = true;
    const loadingId = appendLoading();

    try {
        const res = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
        });

        removeLoading(loadingId);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 429) {
                appendMessage('ai', '⏳ AI günlük istek kotası doldu. Birkaç dakika bekleyip tekrar deneyin.', true);
            } else {
                appendMessage('ai', `Hata: ${err.error || 'Bilinmeyen hata'}`, true);
            }
            return;
        }

        const data = await res.json();
        appendMessage('ai', data.answer);

    } catch (err) {
        removeLoading(loadingId);
        appendMessage('ai', 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.', true);
        console.error('AI Chat fetch hatası:', err);
    } finally {
        sendBtn.disabled = false;
    }
}

// ----------------------------------------------------------------
// DOM Yardımcıları
// ----------------------------------------------------------------

function appendMessage(role, text, isError = false) {
    const isUser = role === 'user';

    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`;

    const avatar = document.createElement('div');
    if (isUser) {
        avatar.className = 'w-7 h-7 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center mt-0.5';
        avatar.innerHTML = `<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;
    } else {
        avatar.className = 'w-7 h-7 rounded-full bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center mt-0.5 overflow-hidden p-0.5';
        avatar.innerHTML = `<img src="images/teknikcrmlogo.png" class="w-full h-full object-contain" alt="AI">`;
    }

    const bubble = document.createElement('div');
    const baseClass = isUser
        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
        : isError
            ? 'bg-red-50 border border-red-100 text-red-700 rounded-2xl rounded-tl-sm'
            : 'bg-white border border-gray-100 text-gray-700 shadow-sm rounded-2xl rounded-tl-sm';

    bubble.className = `${baseClass} px-4 py-3 max-w-xs text-sm leading-relaxed`;
    // Render basit markdown: \n -> <br>, **bold**, *italic*, - list items
    bubble.innerHTML = renderMarkdown(text);

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;

    return wrapper;
}

function appendLoading() {
    const id = 'ai-loading-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'flex gap-2.5';
    wrapper.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center mt-0.5 overflow-hidden p-0.5">
            <img src="images/teknikcrmlogo.png" class="w-full h-full object-contain" alt="AI">
        </div>
        <div class="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:0s"></span>
            <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:.15s"></span>
            <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:.3s"></span>
        </div>
    `;
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return id;
}

function removeLoading(id) {
    document.getElementById(id)?.remove();
}

/**
 * Basit markdown → HTML dönüşümü
 * - **bold**
 * - satır başı - veya * olan listeler
 * - \n → <br>
 */
function renderMarkdown(text) {
    let html = text
        // Escape HTML to prevent XSS
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold: **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic: *text* (only single stars not followed by another *)
        .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
        // Unordered list items: lines starting with - or •
        .replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>')
        // Numbered list items: lines starting with 1. 2. etc.
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n/g, '<br>');

    // Wrap consecutive <li> items in <ul>
    html = html.replace(/(<li>.*?<\/li>(<br>)?)+/g, (match) => {
        const items = match.replace(/<br>/g, '');
        return `<ul class="list-disc pl-4 space-y-1 my-1">${items}</ul>`;
    });

    return html;
}
