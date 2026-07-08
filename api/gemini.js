import { GoogleGenerativeAI } from '@google/generative-ai';
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY ortam değişkeni ayarlanmamış.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const fullPrompt = context
            ? `Bağlam / Bilgiler (Context):\n${context}\n\nİstek (Prompt):\n${prompt}`
            : prompt;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

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
        console.error('Gemini API Hatası:', error);

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

        return res.status(500).json({ error: 'Gemini API çağrısında hata oluştu: ' + error.message });
    }
}
