import 'dotenv/config';
import { getSupabaseClient } from './supabaseClient.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Sadece POST desteklenir.' });
    }

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
            `- ${formatCustomer(c)} (ID: ${c.id}) | Tel: ${c.phone || '-'} | ${c.province || '-'}/${c.district || '-'}`
        ).join('\n')}

=== TEKNİK DESTEK KAYITLARI (son 100) ===
${supports.map(s =>
            `- #${s.support_number} | ${s.customers ? formatCustomer(s.customers) : '-'} | Konu: ${s.subject} | Durum: ${s.status} | Tip: ${s.servis_tipi} | Başlangıç: ${s.start_time ? s.start_time.slice(0, 10) : '-'}`
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
GÖREVIN: Kullanıcının sorusunu YUKARIDAKİ VERİTABANI VERİLERİNİ kullanarak yanıtlamak ve gerektiğinde doğrudan yeni kayıtlar oluşturmak.

KURALLAR:
- Selamlaşma, teşekkür veya genel sohbet isteklerine dostça ve profesyonel bir şekilde yanıt ver.
- Tarih işlemlerinde BUGÜNÜN TARİHİ'ni baz al: ${today}
- Yanıtlarda tablolar yerine okunması kolay madde listeleri kullan.
- Veritabanında eşleşen bir bilgi yoksa "Bu konuda veritabanında veri bulunamadı." de.

KAYIT OLUŞTURMA KURALLARI (ÇOK ÖNEMLİ):
1. Eğer kullanıcı sistemde olmayan (MÜŞTERİLER listesinde bulunmayan) yeni bir müşteri için talepte bulunursa, doğrudan ve beklemeden 'create_customer' aracını (tool) çağır. Eksik bilgileri (telefon, il vb.) varsayılan olarak boş bırak veya kullanıcıdan daha sonra iste, ama ASLA simülasyon yapma ve süreci durdurma.
2. Eğer müşteri zaten veritabanında varsa (isim veya şirket adıyla eşleşiyorsa), onun ID değerini tespit et ve doğrudan 'create_technical_support' aracını (tool) çağır.
3. Kesinlikle "SİMÜLASYON: Yapay zeka create_customer fonksiyonunu tetiklemek istedi" gibi metinler üretme. Sen gerçek çalışan bir sistemsin, doğrudan araçları tetikle.

VERİTABANI VERİLERİ:
${ctx}`;

        // --- Araç Tanımları (Tools) ---
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'create_customer',
                    description: 'Sistemde kayıtlı olmayan yeni bir müşteri firması oluşturur.',
                    parameters: {
                        type: 'object',
                        properties: {
                            company_name: {
                                type: 'string',
                                description: 'Şirket/Firma adı (Zorunlu)'
                            },
                            phone: {
                                type: 'string',
                                description: 'Telefon numarası'
                            },
                            province: {
                                type: 'string',
                                description: 'Bulunduğu il'
                            },
                            district: {
                                type: 'string',
                                description: 'Bulunduğu ilçe'
                            }
                        },
                        required: ['company_name']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'create_technical_support',
                    description: 'Müşteri için yeni bir teknik destek/arıza kaydı oluşturur.',
                    parameters: {
                        type: 'object',
                        properties: {
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID) (Zorunlu)'
                            },
                            subject: {
                                type: 'string',
                                description: 'Destek konusu / başlığı (Zorunlu)'
                            },
                            description: {
                                type: 'string',
                                description: 'Destek kaydı hakkında detaylı açıklama'
                            },

                            servis_tipi: {
                                type: 'string',
                                enum: ['Ucretli', 'Ucretsiz'],
                                description: 'Verilecek teknik desteğin servis ücretlendirme tipi'
                            },
                            caller_name: {
                                type: 'string',
                                description: 'Destek talep eden / arayan kişi'
                            }
                        },
                        required: ['customer_id', 'subject']
                    }
                }
            }
        ];

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
                temperature: 0.3,
                tools,
                tool_choice: 'auto'
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Groq API Hata Detayı:', errData);
            throw new Error(errData.error?.message || `HTTP Hata: ${response.status}`);
        }

        const data = await response.json();
        const messageResponse = data.choices[0]?.message;

        // Yapay zeka araç çağırmak istedi mi?
        if (messageResponse?.tool_calls && messageResponse.tool_calls.length > 0) {
            const firstCall = messageResponse.tool_calls[0];
            const funcName = firstCall.function.name;
            const args = JSON.parse(firstCall.function.arguments || '{}');
            let toolResultContent = '';

            console.log(`[AI-CHAT TOOL CALL] Fonksiyon: ${funcName}, Argümanlar:`, args);

            if (funcName === 'create_customer') {
                const { company_name, phone, province, district } = args;
                const nameParts = (company_name || "Müşteri").split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || 'Soyadı';

                const { data, error } = await supabase
                    .from('customers')
                    .insert([{
                        first_name: firstName,
                        last_name: lastName,
                        company_name: company_name || null,
                        phone: phone || 'Girilmedi',
                        province: province || null,
                        district: district || null
                    }])
                    .select();

                if (error) {
                    console.error('Müşteri oluşturma hatası:', error);
                    toolResultContent = `Hata oluştu: ${error.message}`;
                } else {
                    toolResultContent = `Müşteri başarıyla oluşturuldu. Müşteri ID: ${data[0].id}`;
                }
            } else if (funcName === 'create_technical_support') {
                const { customer_id, subject, description, servis_tipi, caller_name } = args;

                // customer_id'nin geçerli bir UUID formatında olup olmadığını basitçe doğrula
                if (!customer_id || customer_id.length < 10) {
                    toolResultContent = `Hata: Geçersiz müşteri ID'si (${customer_id}). Destek kaydı oluşturmak için önce geçerli bir müşterinin ID'si verilmelidir.`;
                } else {
                    const { data, error } = await supabase
                        .from('technical_supports')
                        .insert([{
                            customer_id: customer_id,
                            caller_name: caller_name || 'Girilmedi',
                            subject: subject || 'Genel Destek Talebi',
                            description: description || null,
                            servis_tipi: servis_tipi || 'Ucretsiz', // Şemadaki varsayılan değer
                            status: 'Acik'
                        }])
                        .select();

                    if (error) {
                        console.error('Destek kaydı oluşturma hatası:', error);
                        toolResultContent = `Hata oluştu: ${error.message}`;
                    } else {
                        toolResultContent = `Teknik destek talebi başarıyla oluşturuldu. Destek Numarası: ${data[0].support_number}`;
                    }
                }
            } else {
                toolResultContent = "Bilinmeyen araç çağrısı.";
            }

            // Yanıtı Groq'a geri besleyerek (tool mesajı ile) 2. aşama (final) yanıtı alalım
            const secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message },
                        messageResponse, // AI'nin asıl yanıtı (tool_calls içerir)
                        {
                            role: 'tool',
                            tool_call_id: firstCall.id,
                            name: funcName,
                            content: toolResultContent
                        }
                    ],
                    temperature: 0.3
                })
            });

            if (!secondResponse.ok) {
                const errData = await secondResponse.json().catch(() => ({}));
                console.error('Groq API 2. Aşama Hata Detayı:', errData);
                throw new Error(errData.error?.message || `HTTP Hata (2. aşama): ${secondResponse.status}`);
            }

            const secondData = await secondResponse.json();
            const finalAnswer = secondData.choices[0]?.message?.content || 'İşlem tamamlandı, ancak yanıt alınamadı.';
            return res.status(200).json({ answer: finalAnswer });
        }

        const answer = messageResponse?.content || 'Yanıt alınamadı.';
        return res.status(200).json({ answer });

    } catch (error) {
        console.error('AI Chat hatası:', error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ error: 'AI günlük istek kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.' });
        }
        return res.status(500).json({ error: 'AI yanıt üretilemedi: ' + error.message });
    }
}
