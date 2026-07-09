import { getSupabaseClient } from './supabaseClient.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Sadece POST desteklenir.' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message parametresi eksik.' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY ortam değişkeni eksik.' });

    try {
        const supabase = getSupabaseClient();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // --- Supabase'den bağlamsal veri topla ---
        const [
            resCustomers,
            resSupports,
            resTasks,
            resVisits,
            resLicenses,
        ] = await Promise.all([
            supabase.from('customers')
                .select('id, first_name, last_name, company_name, phone, province, district, is_active, notes')
                .eq('is_active', true)
                .order('company_name')
                .limit(200),
            supabase.from('technical_supports')
                .select('id, support_number, subject, status, caller_name, servis_tipi, start_time, end_time, description, resolution, customers(company_name, first_name, last_name)')
                .order('created_at', { ascending: false })
                .limit(100),
            supabase.from('tasks')
                .select('id, title, description, status, priority, start_date, end_date, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)')
                .order('end_date', { ascending: true })
                .limit(100),
            supabase.from('visits')
                .select('id, visit_date, visit_time, status, purpose, notes, work_done, result, customers(company_name, first_name, last_name), assigned:profiles!visits_assigned_to_fkey(full_name)')
                .order('visit_date', { ascending: false })
                .limit(100),
            supabase.from('licenses')
                .select('id, license_number, program_name, version, maintenance_end, customers(company_name, first_name, last_name)')
                .order('maintenance_end', { ascending: true })
                .limit(100),
        ]);

        if (resCustomers.error) console.error('AI Chat: Customers Query Error:', resCustomers.error);
        if (resSupports.error) console.error('AI Chat: Supports Query Error:', resSupports.error);
        if (resTasks.error) console.error('AI Chat: Tasks Query Error:', resTasks.error);
        if (resVisits.error) console.error('AI Chat: Visits Query Error:', resVisits.error);
        if (resLicenses.error) console.error('AI Chat: Licenses Query Error:', resLicenses.error);

        const customers = resCustomers.data || [];
        const supports = resSupports.data || [];
        const tasks = resTasks.data || [];
        const visits = resVisits.data || [];
        const licenses = resLicenses.data || [];

        console.log(`AI Chat DB Counts - Customers: ${customers.length}, Supports: ${supports.length}, Tasks: ${tasks.length}, Visits: ${visits.length}, Licenses: ${licenses.length}`);

        // --- Bağlam metni oluştur ---
        const formatCustomer = (c) =>
            `${c.company_name || `${c.first_name} ${c.last_name}`}`;

        const ctx = `
BUGÜNÜN TARİHİ: ${today}

=== MÜŞTERİLER (${customers.length} aktif) ===
${customers.map(c =>
    `- ${formatCustomer(c)} | Tel: ${c.phone || '-'} | ${c.province || '-'}/${c.district || '-'}`
).join('\n')}

=== TEKNİK DESTEK KAYITLARI (son 100) ===
${supports.map(s =>
    `- #${s.support_number} | ${s.customers ? formatCustomer(s.customers) : '-'} | Konu: ${s.subject} | Durum: ${s.status} | Tip: ${s.servis_tipi} | Başlangıç: ${s.start_time ? s.start_time.slice(0,10) : '-'}`
).join('\n')}

=== GÖREVLER (son 100) ===
${tasks.map(t =>
    `- ${t.title} | Müşteri: ${t.customers ? formatCustomer(t.customers) : '-'} | Durum: ${t.status} | Öncelik: ${t.priority} | Bitiş: ${t.end_date || '-'} | Atanan: ${t.assigned?.full_name || '-'}`
).join('\n')}

=== ZİYARETLER (son 100) ===
${visits.map(v =>
    `- ${v.visit_date} ${v.visit_time || ''} | Müşteri: ${v.customers ? formatCustomer(v.customers) : '-'} | Durum: ${v.status} | Amaç: ${v.purpose || '-'} | Atanan: ${v.assigned?.full_name || '-'}`
).join('\n')}

=== LİSANSLAR (son 100) ===
${licenses.map(l =>
    `- ${l.program_name} v${l.version || '?'} | Müşteri: ${l.customers ? formatCustomer(l.customers) : '-'} | Bakım Sonu: ${l.maintenance_end || '-'}`
).join('\n')}
`.trim();

        const systemPrompt = `Sen TeknikCRM adlı bir Akınsoft bayi CRM sisteminin AI asistanısın.
GÖREVIN: Kullanıcının sorusunu YUKARIDAKİ VERİTABANI VERİLERİNİ kullanarak yanıtlamak.
KURALLAR:
- Selamlaşma, teşekkür veya genel sohbet isteklerine (örn. Merhaba, nasılsın, yardım vb.) dostça ve profesyonel bir şekilde yanıt ver.
- Sistem/veritabanı ile ilgili sorular için sadece verilen veritabanı verileriyle çalış. Dışarıdan bilgi veya müşteri uydurma.
- Yanıtlarını kısa, net ve Türkçe olarak ver.
- Listele dediğinde madde madde listele.
- Tarih işlemlerinde BUGÜNÜN TARİHİ'ni baz al: ${today}
- Kullanıcı bir müşteri soruyor ise, o müşterinin tüm destek kayıtlarını, görevlerini ve ziyaretlerini getir.
- Veritabanı sorularında eşleşen veya ilgili bir bilgi yoksa "Bu konuda veritabanında veri bulunamadı." de.
- Yanıtlara tablolar yerine madde listeleri kullan (okunması kolay olsun).

VERİTABANI VERİLERİ:
${ctx}`;

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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
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
        const answer = data.choices[0]?.message?.content || 'Yanıt alınamadı.';
        return res.status(200).json({ answer });

    } catch (error) {
        console.error('AI Chat hatası:', error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ error: 'AI günlük istek kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.' });
        }
        return res.status(500).json({ error: 'AI yanıt üretilemedi: ' + error.message });
    }
}
