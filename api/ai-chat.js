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

        // --- Supabase'den sadece hafif sayaç bilgileri (counts) al ---
        const [
            countCustomers,
            countSupports,
            countTasks,
            countVisits,
            countLicenses
        ] = await Promise.all([
            supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('technical_supports').select('*', { count: 'exact', head: true }).eq('status', 'Acik'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['Bekliyor', 'Yapiliyor']),
            supabase.from('visits').select('*', { count: 'exact', head: true }).eq('visit_date', today),
            supabase.from('licenses').select('*', { count: 'exact', head: true })
        ]);

        if (countCustomers.error) console.error('AI Chat: Customers Count Error:', countCustomers.error);
        if (countSupports.error) console.error('AI Chat: Supports Count Error:', countSupports.error);
        if (countTasks.error) console.error('AI Chat: Tasks Count Error:', countTasks.error);
        if (countVisits.error) console.error('AI Chat: Visits Count Error:', countVisits.error);
        if (countLicenses.error) console.error('AI Chat: Licenses Count Error:', countLicenses.error);

        const customersCount = countCustomers.count || 0;
        const openSupportsCount = countSupports.count || 0;
        const activeTasksCount = countTasks.count || 0;
        const visitsTodayCount = countVisits.count || 0;
        const licensesCount = countLicenses.count || 0;

        console.log(`AI Chat DB Counts - Customers: ${customersCount}, Supports: ${openSupportsCount}, Tasks: ${activeTasksCount}, Visits: ${visitsTodayCount}, Licenses: ${licensesCount}`);

        // --- Bağlam metni oluştur ---
        const ctx = `
BUGÜNÜN TARİHİ: ${today}

=== SİSTEM İSTATİSTİKLERİ ===
- Aktif Müşteri Sayısı: ${customersCount}
- Açık Destek Kaydı Sayısı: ${openSupportsCount}
- Bekleyen/Yapılmakta Olan Görev Sayısı: ${activeTasksCount}
- Bugün Planlanan Ziyaret Sayısı: ${visitsTodayCount}
- Toplam Lisans Sayısı: ${licensesCount}

=== ARAMA VE BİLGİ EDİNDİRME ARAÇLARI ===
Veritabanında arama yapmak, detaylı kayıt listelemek veya belirli bir müşteriyi sorgulamak için tanımlı 'search_' ve 'get_' araçlarını (tools) KULLANMALISIN.
Sana doğrudan tüm liste verilmez. Bir müşteriyi veya kaydı bulmak için sorguya göre arama aracı tetiklemelisin.
Örnek: "tuse" firmasını bulmak için önce 'search_customers' aracını query="tuse" parametresiyle çağır.
Bugünün ziyaretlerini listelemek için 'get_visits' aracını date="${today}" parametresiyle çağır.
`;

        const systemPrompt = `Sen TeknikCRM adlı bir Akınsoft bayi CRM sisteminin AI asistanısın.
GÖREVIN: Kullanıcının sorusunu YUKARIDAKİ VERİTABANI İSTATİSTİKLERİNİ ve ARAMA ARAÇLARINI kullanarak yanıtlamak ve gerektiğinde doğrudan yeni kayıtlar oluşturmak.

ÖNEMLİ KURALLAR:
- Selamlaşma, teşekkür veya genel sohbet isteklerine dostça ve profesyonel bir şekilde yanıt ver.
- Tarih işlemlerinde BUGÜNÜN TARİHİ'ni baz al: ${today}
- Yanıtlarda tablolar yerine okunması kolay madde listeleri kullan.
- Veritabanında arama sonucu bulunamazsa "Bu konuda veritabanında veri bulunamadı." de.

FONKSİYON/ARAÇ ÇAĞIRMA KURALLARI (KRİTİK):
1. ARAÇLARI ASLA İÇ İÇE (NESTED) ÇAĞIRMA! Bir parametre (örneğin customer_id) değeri içerisine asla "<function=search_customers>..." gibi başka bir fonksiyon çağırma ifadesi veya XML etiketi yazma! Bu durum sistemin hata vermesine yol açar.
2. Bir işlem yapmadan önce eğer müşteri adını biliyorsan ama müşteri ID (UUID) elinde yoksa, ilk adımda SADECE 'search_customers' aracını çağır. Başka hiçbir araç çağırma. Arama sonucunda dönen gerçek UUID'yi aldıktan sonra, sonraki adımda 'create_task' veya 'create_technical_support' aracını tetikleyebilirsin.
3. Eğer arama sonucu hiçbir müşteri bulunamazsa ve kullanıcı yeni bir müşteri kaydı oluşturmak istiyorsa, 'create_customer' aracını çağır. Müşteri başarıyla oluşturulduktan sonra dönen gerçek ID ile bir sonraki adımda diğer kaydı oluştur.
4. Kesinlikle "SİMÜLASYON: Yapay zeka create_customer fonksiyonunu tetiklemek istedi" gibi metinler üretme. Sen gerçek çalışan bir sistemsin, doğrudan araçları tetikle.

SİSTEM VE SORGULAMA VERİLERİ:
${ctx}`;

        // --- Araç Tanımları (Tools) ---
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'search_customers',
                    description: 'Müşterileri isim, şirket/firma adı veya telefon numarasına göre veritabanında arar.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Arama terimi (isim, şirket adı veya telefon)'
                            }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_technical_supports',
                    description: 'Teknik destek kayıtlarını filtreleyip getirir.',
                    parameters: {
                        type: 'object',
                        properties: {
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID) - Belirli bir müşterinin kayıtları için'
                            },
                            status: {
                                type: 'string',
                                enum: ['Acik', 'Cozuldu', 'Iptal'],
                                description: 'Destek kaydı durumu'
                            },
                            limit: {
                                type: 'integer',
                                description: 'Getirilecek maksimum kayıt sayısı (varsayılan: 20)'
                            }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_tasks',
                    description: 'Görevleri filtreleyip getirir.',
                    parameters: {
                        type: 'object',
                        properties: {
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID) - Belirli bir müşterinin görevleri için'
                            },
                            status: {
                                type: 'string',
                                enum: ['Bekliyor', 'Yapiliyor', 'Tamamlandi', 'Iptal'],
                                description: 'Görev durumu'
                            },
                            priority: {
                                type: 'string',
                                enum: ['Dusuk', 'Orta', 'Yuksek'],
                                description: 'Görev önceliği'
                            },
                            limit: {
                                type: 'integer',
                                description: 'Getirilecek maksimum kayıt sayısı (varsayılan: 20)'
                            }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_visits',
                    description: 'Ziyaret planlarını filtreleyip getirir.',
                    parameters: {
                        type: 'object',
                        properties: {
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID)'
                            },
                            date: {
                                type: 'string',
                                description: 'Belirli bir tarih (YYYY-MM-DD)'
                            },
                            status: {
                                type: 'string',
                                enum: ['Planlandi', 'Tamamlandi', 'Iptal'],
                                description: 'Ziyaret durumu'
                            },
                            limit: {
                                type: 'integer',
                                description: 'Getirilecek maksimum kayıt sayısı (varsayılan: 20)'
                            }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_licenses',
                    description: 'Müşteri lisans bilgilerini filtreleyip getirir.',
                    parameters: {
                        type: 'object',
                        properties: {
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID)'
                            },
                            limit: {
                                type: 'integer',
                                description: 'Getirilecek maksimum kayıt sayısı (varsayılan: 20)'
                            }
                        }
                    }
                }
            },
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
                                description: 'Müşteri ID\'si (UUID) (Zorunlu). Eğer elinizde müşterinin UUID formatındaki ID\'si yoksa bu fonksiyonu çağırmayın! Önce \'search_customers\' fonksiyonunu çağırarak ID\'yi bulun.'
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
            },
            {
                type: 'function',
                function: {
                    name: 'create_task',
                    description: 'Sisteme yeni bir görev ekler veya bir personeli görevlendirir.',
                    parameters: {
                        type: 'object',
                        properties: {
                            title: {
                                type: 'string',
                                description: 'Görev Başlığı (Zorunlu)'
                            },
                            description: {
                                type: 'string',
                                description: 'Görev Açıklaması'
                            },
                            customer_id: {
                                type: 'string',
                                description: 'Müşteri ID\'si (UUID). Eğer elinizde müşterinin UUID formatındaki ID\'si yoksa, bu parametreyi boş bırakın veya önce \'search_customers\' fonksiyonunu çağırarak ID\'yi bulun. Asla geçersiz veya uydurma bir ID girmeyin.'
                            },
                            assigned_to: {
                                type: 'string',
                                description: 'Atanan Personel ID\'si (UUID)'
                            },
                            priority: {
                                type: 'string',
                                enum: ['Dusuk', 'Orta', 'Yuksek'],
                                description: 'Görev Önceliği'
                            },
                            status: {
                                type: 'string',
                                enum: ['Bekliyor', 'Yapiliyor', 'Tamamlandi', 'Iptal'],
                                description: 'Görev Durumu'
                            },
                            start_date: {
                                type: 'string',
                                description: 'Başlangıç Tarihi (YYYY-MM-DD)'
                            },
                            end_date: {
                                type: 'string',
                                description: 'Bitiş Tarihi (YYYY-MM-DD)'
                            }
                        },
                        required: ['title']
                    }
                }
            }
        ];

        let messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ];

        let loopCount = 0;
        const maxLoops = 5;
        let finalResponse = null;

        while (loopCount < maxLoops) {
            console.log(`[AI-CHAT LOOP] Tur: ${loopCount + 1}`);

            // --- Groq API çağrısı ---
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
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

            if (!messageResponse) {
                throw new Error('Groq boş yanıt döndü.');
            }

            // AI cevabını geçmişe ekleyelim
            messages.push(messageResponse);

            // Yapay zeka araç çağırmak istedi mi?
            if (messageResponse.tool_calls && messageResponse.tool_calls.length > 0) {
                console.log(`[AI-CHAT] AI ${messageResponse.tool_calls.length} adet araç çağrısı yapmak istiyor.`);

                // Aynı turda hem arama/müşteri ekleme hem de bağlı kayıt oluşturma paralel yapılmasını engelle.
                // Bu sayede mükerrer kayıt eklenmesi ve müşterisiz kayıt oluşturulması önlenir.
                const hasSearch = messageResponse.tool_calls.some(tc => tc.function.name === 'search_customers');
                const hasCreateCustomer = messageResponse.tool_calls.some(tc => tc.function.name === 'create_customer');

                for (const toolCall of messageResponse.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    let toolResultContent = '';

                    console.log(`[AI-CHAT TOOL CALL] Fonksiyon: ${funcName}, Argümanlar:`, args);

                    try {
                        if ((hasSearch || hasCreateCustomer) && (funcName === 'create_task' || funcName === 'create_technical_support')) {
                            toolResultContent = `İptal edildi: Aynı turda hem arama/müşteri ekleme hem de bağlı kayıt oluşturma paralel yapılamaz. Lütfen önce müşteri ID'sini (UUID) elde edin, bir sonraki turda bu ID ile kaydı oluşturun.`;
                            console.log(`[AI-CHAT TOOL CALL] Deferring ${funcName} because customer is not yet resolved.`);
                        }
                        else if (funcName === 'search_customers') {
                            const { query } = args;
                            let queryBuilder = supabase.from('customers')
                                .select('id, first_name, last_name, company_name, phone, province, district, is_active, notes')
                                .eq('is_active', true);

                            if (query) {
                                const words = query.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 3);
                                if (words.length > 0) {
                                    let orParts = [];
                                    for (const word of words) {
                                        const cleanWord = word
                                            .replace(/ı/g, 'i')
                                            .replace(/ş/g, 's')
                                            .replace(/ğ/g, 'g')
                                            .replace(/ç/g, 'c')
                                            .replace(/ö/g, 'o')
                                            .replace(/ü/g, 'u')
                                            .replace(/I/g, 'i')
                                            .replace(/İ/g, 'i')
                                            .replace(/Ş/g, 's')
                                            .replace(/Ğ/g, 'g')
                                            .replace(/Ç/g, 'c')
                                            .replace(/Ö/g, 'o')
                                            .replace(/Ü/g, 'u');
                                        
                                        orParts.push(`company_name.ilike.%${word}%`);
                                        orParts.push(`first_name.ilike.%${word}%`);
                                        orParts.push(`last_name.ilike.%${word}%`);
                                        
                                        if (cleanWord !== word) {
                                            orParts.push(`company_name.ilike.%${cleanWord}%`);
                                            orParts.push(`first_name.ilike.%${cleanWord}%`);
                                            orParts.push(`last_name.ilike.%${cleanWord}%`);
                                        }
                                    }
                                    queryBuilder = queryBuilder.or(orParts.join(','));
                                } else {
                                    queryBuilder = queryBuilder.or(`company_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%`);
                                }
                            }

                            const { data: custData, error: custErr } = await queryBuilder.limit(20);

                            if (custErr) {
                                toolResultContent = `Müşteri arama hatası: ${custErr.message}`;
                            } else {
                                toolResultContent = JSON.stringify(custData || []);
                            }
                        }
                        else if (funcName === 'get_technical_supports') {
                            const { customer_id, status, limit } = args;
                            let queryBuilder = supabase.from('technical_supports')
                                .select('id, support_number, subject, status, caller_name, servis_tipi, start_time, end_time, description, resolution, customers(company_name, first_name, last_name)');

                            if (customer_id) {
                                queryBuilder = queryBuilder.eq('customer_id', customer_id);
                            }
                            if (status) {
                                queryBuilder = queryBuilder.eq('status', status);
                            }

                            const { data: suppData, error: suppErr } = await queryBuilder
                                .order('created_at', { ascending: false })
                                .limit(limit || 20);

                            if (suppErr) {
                                toolResultContent = `Destek kaydı getirme hatası: ${suppErr.message}`;
                            } else {
                                toolResultContent = JSON.stringify(suppData || []);
                            }
                        }
                        else if (funcName === 'get_tasks') {
                            const { customer_id, status, priority, limit } = args;
                            let queryBuilder = supabase.from('tasks')
                                .select('id, title, description, status, priority, start_date, end_date, customers(company_name, first_name, last_name), assigned:profiles!tasks_assigned_to_fkey(full_name)');

                            if (customer_id) {
                                queryBuilder = queryBuilder.eq('customer_id', customer_id);
                            }
                            if (status) {
                                queryBuilder = queryBuilder.eq('status', status);
                            }
                            if (priority) {
                                queryBuilder = queryBuilder.eq('priority', priority);
                            }

                            const { data: taskData, error: taskErr } = await queryBuilder
                                .order('end_date', { ascending: true })
                                .limit(limit || 20);

                            if (taskErr) {
                                toolResultContent = `Görev getirme hatası: ${taskErr.message}`;
                            } else {
                                toolResultContent = JSON.stringify(taskData || []);
                            }
                        }
                        else if (funcName === 'get_visits') {
                            const { customer_id, date, status, limit } = args;
                            let queryBuilder = supabase.from('visits')
                                .select('id, visit_date, visit_time, status, purpose, notes, work_done, result, customers(company_name, first_name, last_name), assigned:profiles!visits_assigned_to_fkey(full_name)');

                            if (customer_id) {
                                queryBuilder = queryBuilder.eq('customer_id', customer_id);
                            }
                            if (date) {
                                queryBuilder = queryBuilder.eq('visit_date', date);
                            }
                            if (status) {
                                queryBuilder = queryBuilder.eq('status', status);
                            }

                            const { data: visitData, error: visitErr } = await queryBuilder
                                .order('visit_date', { ascending: false })
                                .limit(limit || 20);

                            if (visitErr) {
                                toolResultContent = `Ziyaret getirme hatası: ${visitErr.message}`;
                            } else {
                                toolResultContent = JSON.stringify(visitData || []);
                            }
                        }
                        else if (funcName === 'get_licenses') {
                            const { customer_id, limit } = args;
                            let queryBuilder = supabase.from('licenses')
                                .select('id, license_number, program_name, version, maintenance_end, customers(company_name, first_name, last_name)');

                            if (customer_id) {
                                queryBuilder = queryBuilder.eq('customer_id', customer_id);
                            }

                            const { data: licData, error: licErr } = await queryBuilder
                                .order('maintenance_end', { ascending: true })
                                .limit(limit || 20);

                            if (licErr) {
                                toolResultContent = `Lisans getirme hatası: ${licErr.message}`;
                            } else {
                                toolResultContent = JSON.stringify(licData || []);
                            }
                        }
                        else if (funcName === 'create_customer') {
                            const { company_name, phone, province, district } = args;
                            const nameParts = (company_name || "Müşteri").split(' ');
                            const firstName = nameParts[0];
                            const lastName = nameParts.slice(1).join(' ') || 'Soyadı';

                            const { data: newCust, error: newCustErr } = await supabase
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

                            if (newCustErr) {
                                toolResultContent = `Müşteri oluşturma hatası: ${newCustErr.message}`;
                            } else {
                                toolResultContent = `Müşteri başarıyla oluşturuldu. Müşteri ID: ${newCust[0].id}`;
                            }
                        }
                        else if (funcName === 'create_technical_support') {
                            const { customer_id, subject, description, servis_tipi, caller_name } = args;

                            if (!customer_id || customer_id.length < 10) {
                                toolResultContent = `Hata: Geçersiz müşteri ID'si (${customer_id}). Destek kaydı oluşturmak için önce geçerli bir müşterinin ID'si verilmelidir.`;
                            } else {
                                const { data: newSupp, error: newSuppErr } = await supabase
                                    .from('technical_supports')
                                    .insert([{
                                        customer_id: customer_id,
                                        caller_name: caller_name || 'Girilmedi',
                                        subject: subject || 'Genel Destek Talebi',
                                        description: description || null,
                                        servis_tipi: servis_tipi || 'Ucretsiz',
                                        status: 'Acik'
                                    }])
                                    .select();

                                if (newSuppErr) {
                                    toolResultContent = `Destek kaydı oluşturma hatası: ${newSuppErr.message}`;
                                } else {
                                    toolResultContent = `Teknik destek talebi başarıyla oluşturuldu. Destek Numarası: ${newSupp[0].support_number}`;
                                }
                            }
                        }
                        else if (funcName === 'create_task') {
                            const { title, description, customer_id, assigned_to, priority, status, start_date, end_date } = args;

                            const { data: newTask, error: newTaskErr } = await supabase
                                .from('tasks')
                                .insert([{
                                    title: title,
                                    description: description || null,
                                    customer_id: customer_id || null,
                                    assigned_to: assigned_to || null,
                                    priority: priority || 'Orta',
                                    status: status || 'Bekliyor',
                                    start_date: start_date || null,
                                    end_date: end_date || null
                                }])
                                .select();

                            if (newTaskErr) {
                                toolResultContent = `Görev oluşturma hatası: ${newTaskErr.message}`;
                            } else {
                                toolResultContent = `Görev başarıyla oluşturuldu. Görev Başlığı: ${newTask[0].title}`;
                            }
                        }
                        else {
                            toolResultContent = "Bilinmeyen araç çağrısı.";
                        }
                    } catch (e) {
                        console.error(`Araç yürütülürken hata: ${funcName}`, e);
                        toolResultContent = `Araç çalıştırılırken sistem hatası: ${e.message}`;
                    }

                    // Sonucu mesaj geçmişine ekle
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: funcName,
                        content: toolResultContent
                    });
                }

                loopCount++;
            } else {
                // Araç çağrılmadıysa döngüden çık, bu final cevaptır.
                finalResponse = messageResponse.content;
                break;
            }
        }

        if (!finalResponse) {
            const lastMsg = messages[messages.length - 1];
            finalResponse = lastMsg?.content || 'İşlem tamamlandı, ancak yanıt alınamadı.';
        }

        return res.status(200).json({ answer: finalResponse });

    } catch (error) {
        console.error('AI Chat hatası:', error);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return res.status(429).json({ error: 'AI günlük istek kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.' });
        }
        return res.status(500).json({ error: 'AI yanıt üretilemedi: ' + error.message });
    }
}
