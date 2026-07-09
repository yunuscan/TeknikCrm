import { getSupabaseClient } from './supabaseClient.js';

export default async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Sadece POST metodu desteklenir.' });
    }

    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt parametresi eksik.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY ortam değişkeni ayarlanmamış.' });
    }

    try {
        const fullPrompt = context
            ? `Bağlam / Bilgiler (Context):\n${context}\n\nİstek (Prompt):\n${prompt}`
            : prompt;

        // --- Groq API çağrısı ---
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'user', content: fullPrompt }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Groq API Hata Detayı:', errData);
            throw new Error(errData.error?.message || `HTTP Hata: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.choices[0]?.message?.content || '';

        // Opsiyonel: AI log tablosuna yazım denemesi
        try {
            const supabase = getSupabaseClient();
            await supabase.from('ai_logs').insert({
                prompt: prompt.substring(0, 1000),
                response_preview: responseText.substring(0, 1000),
                status: 'SUCCESS',
            });
        } catch (logErr) {
            console.error('Supabase AI log yazma hatası:', logErr.message);
        }

        return res.status(200).json({ text: responseText });
    } catch (error) {
        console.error('Groq API Hatası:', error);

        // Hata durumunu loglama
        try {
            const supabase = getSupabaseClient();
            await supabase.from('ai_logs').insert({
                prompt: prompt.substring(0, 1000),
                response_preview: error.message || 'Error occurred',
                status: 'ERROR',
            });
        } catch (logErr) {
            console.error('Supabase AI log yazma hatası:', logErr.message);
        }

        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ error: 'AI günlük istek kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.' });
        }
        return res.status(500).json({ error: 'Groq API çağrısında hata oluştu: ' + error.message });
    }
}
