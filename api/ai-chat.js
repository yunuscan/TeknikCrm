import { GoogleGenerativeAI } from '@google/generative-ai';
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY ortam değişkeni eksik.' });

    try {
        const supabase = getSupabaseClient();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // --- Supabase'den bağlamsal veri topla ---
        const [
            { data: customers },
            { data: supports },
            { data: tasks },
            { data: visits },
            { data: licenses },
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

        // --- Bağlam metni oluştur ---
        const formatCustomer = (c) =>
            `${c.company_name || `${c.first_name} ${c.last_name}`}`;

        const ctx = `
BUGÜNÜN TARİHİ: ${today}

=== MÜŞTERİLER (${customers?.length || 0} aktif) ===
${(customers || []).map(c =>
    `- ${formatCustomer(c)} | Tel: ${c.phone || '-'} | ${c.province || '-'}/${c.district || '-'}`
).join('\n')}

=== TEKNİK DESTEK KAYITLARI (son 100) ===
${(supports || []).map(s =>
    `- #${s.support_number} | ${s.customers ? formatCustomer(s.customers) : '-'} | Konu: ${s.subject} | Durum: ${s.status} | Tip: ${s.servis_tipi} | Başlangıç: ${s.start_time ? s.start_time.slice(0,10) : '-'}`
).join('\n')}

=== GÖREVLER (son 100) ===
${(tasks || []).map(t =>
    `- ${t.title} | Müşteri: ${t.customers ? formatCustomer(t.customers) : '-'} | Durum: ${t.status} | Öncelik: ${t.priority} | Bitiş: ${t.end_date || '-'} | Atanan: ${t.assigned?.full_name || '-'}`
).join('\n')}

=== ZİYARETLER (son 100) ===
${(visits || []).map(v =>
    `- ${v.visit_date} ${v.visit_time || ''} | Müşteri: ${v.customers ? formatCustomer(v.customers) : '-'} | Durum: ${v.status} | Amaç: ${v.purpose || '-'} | Atanan: ${v.assigned?.full_name || '-'}`
).join('\n')}

=== LİSANSLAR (son 100) ===
${(licenses || []).map(l =>
    `- ${l.program_name} v${l.version || '?'} | Müşteri: ${l.customers ? formatCustomer(l.customers) : '-'} | Bakım Sonu: ${l.maintenance_end || '-'}`
).join('\n')}
`.trim();

        // --- Gemini çağrısı ---
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemPrompt = `Sen TeknikCRM adlı bir Akınsoft bayi CRM sisteminin AI asistanısın.
GÖREVIN: Kullanıcının sorusunu YUKARIDAKİ VERİTABANI VERİLERİNİ kullanarak yanıtlamak.
KURALLAR:
- Sadece verilen veritabanı verileriyle çalış. Dışarıdan bilgi ekleme.
- Yanıtlarını kısa, net ve Türkçe olarak ver.
- Listele dediğinde madde madde listele.
- Tarih işlemlerinde BUGÜNÜN TARİHİ'ni baz al: ${today}
- Kullanıcı bir müşteri soruyor ise, o müşterinin tüm destek kayıtlarını, görevlerini ve ziyaretlerini getir.
- Eğer bilgi yoksa "Bu konuda veritabanında veri bulunamadı." de.
- Yanıtlara tablolar yerine madde listeleri kullan (okunması kolay olsun).

VERİTABANI VERİLERİ:
${ctx}`;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nKullanıcı sorusu: ${message}` }] }
            ],
        });

        const answer = result.response.text();
        return res.status(200).json({ answer });

    } catch (error) {
        console.error('AI Chat hatası:', error);
        return res.status(500).json({ error: 'AI yanıt üretilemedi: ' + error.message });
    }
}
