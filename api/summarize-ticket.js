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

    const { ticket_id } = req.body;
    if (!ticket_id) {
        return res.status(400).json({ error: 'ticket_id parametresi eksik.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY ortam değişkeni ayarlanmamış.' });
    }

    try {
        const supabase = getSupabaseClient();

        // 1. Supabase'den bilet verilerini çek
        const { data: ticket, error: ticketError } = await supabase
            .from('technical_supports')
            .select(`
                *,
                customers (*),
                support_logs (*)
            `)
            .eq('id', ticket_id)
            .single();

        if (ticketError || !ticket) {
            return res.status(404).json({ error: 'Teknik destek kaydı bulunamadı: ' + (ticketError?.message || '') });
        }

        // 2. Destek loglarını kronolojik sırala
        const logsSorted = (ticket.support_logs || []).sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        // 3. Bağlam metni (context) oluştur
        let context = `--- TEKNİK DESTEK DETAYI ---\n`;
        context += `Destek No: #${ticket.support_number}\n`;
        context += `Konu: ${ticket.subject || '-'}\n`;
        context += `Açıklama: ${ticket.description || '-'}\n`;
        context += `Mevcut Durum: ${ticket.status || '-'}\n`;
        context += `Servis Tipi: ${ticket.servis_tipi || '-'}\n`;
        context += `Arayan: ${ticket.caller_name || '-'} (${ticket.caller_phone || '-'})\n`;
        if (ticket.resolution) {
            context += `Çözüm Detayı: ${ticket.resolution}\n`;
        }

        if (ticket.customers) {
            const cust = ticket.customers;
            context += `\n--- MÜŞTERİ BİLGİLERİ ---\n`;
            context += `Firma Adı: ${cust.company_name || '-'}\n`;
            context += `Ad Soyad: ${cust.first_name || ''} ${cust.last_name || ''}\n`;
            context += `Telefon: ${cust.phone || '-'}\n`;
            context += `İl/İlçe: ${cust.province || '-'}/${cust.district || '-'}\n`;
            context += `Adres: ${cust.address || '-'}\n`;
            context += `Müşteri Notları: ${cust.notes || '-'}\n`;
        }

        if (logsSorted.length > 0) {
            context += `\n--- YAPILAN İŞLEMLER / LOGLAR ---\n`;
            logsSorted.forEach((log, index) => {
                context += `[Log #${index + 1} - ${new Date(log.created_at).toLocaleString('tr-TR')}]: ${log.log_entry}\n`;
            });
        }

        // 4. Groq API çağrısı yap (JSON Modunda)
        const systemPrompt = `Sen teknik destek biletlerini analiz eden bir AI asistanısın. 
Aşağıdaki teknik destek kaydını (ticket) analiz et. Bu kaydı özetle, destek personeline yardımcı olması için müşteriye yönelik profesyonel bir otomatik yanıt taslağı hazırla ve kayıt için bir öncelik seviyesi öner (Düşük/Orta/Yüksek/Kritik).
Lütfen yanıtını KESİNLİKLE aşağıdaki JSON formatında döndür. JSON haricinde hiçbir metin veya açıklama ekleme:
{
  "ozet": "Kayıt özeti buraya...",
  "oncelik": "Düşük" veya "Orta" veya "Yüksek" veya "Kritik",
  "yanit_taslagi": "Sayın yetkili, talebiniz alınmıştır..."
}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Bağlam (Context):\n${context}` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Groq API Hata Detayı:', errData);
            throw new Error(errData.error?.message || `HTTP Hata: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.choices[0]?.message?.content || '{}';
        
        // Yanıtı parse et
        let resultJson;
        try {
            resultJson = JSON.parse(responseText);
        } catch (parseErr) {
            console.error('Groq JSON parse hatası. Ham yanıt:', responseText);
            resultJson = {
                ozet: 'Özet ayrıştırılamadı. Ham yanıt: ' + responseText,
                oncelik: 'Orta',
                yanit_taslagi: 'Otomatik taslak oluşturulamadı.'
            };
        }

        // Opsiyonel: AI log tablosuna yazım denemesi
        try {
            await supabase.from('ai_logs').insert({
                prompt: `summarize-ticket for ID: ${ticket_id}`,
                response_preview: responseText.substring(0, 1000),
                status: 'SUCCESS',
            });
        } catch (logErr) {
            console.error('Supabase AI log yazma hatası:', logErr.message);
        }

        return res.status(200).json(resultJson);
    } catch (error) {
        console.error('Ticket özetleme hatası:', error);

        // Hata durumunu loglama
        try {
            const supabase = getSupabaseClient();
            await supabase.from('ai_logs').insert({
                prompt: `summarize-ticket for ID: ${ticket_id}`,
                response_preview: error.message || 'Error occurred',
                status: 'ERROR',
            });
        } catch (logErr) {
            console.error('Supabase AI log yazma hatası:', logErr.message);
        }

        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ error: 'AI günlük istek kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.' });
        }
        return res.status(500).json({ error: 'Bilet özetlenirken bir hata oluştu: ' + error.message });
    }
}
