import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from './api/supabaseClient.js';

// Parse .env.local manually
try {
    const envLocalPath = path.resolve('.env.local');
    if (fs.existsSync(envLocalPath)) {
        const envContent = fs.readFileSync(envLocalPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const parts = trimmed.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim();
                    process.env[key] = value;
                }
            }
        });
    }
} catch (err) {
    console.error('Error loading env:', err);
}

async function readLogs() {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('ai_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error reading ai_logs:', error);
        } else {
            console.log(`Retrieved ${data.length} logs from ai_logs:`);
            data.forEach((log, index) => {
                console.log(`\n--- Log #${index + 1} ---`);
                console.log(`ID: ${log.id}`);
                console.log(`Created At: ${log.created_at}`);
                console.log(`Status: ${log.status}`);
                console.log(`Prompt (first 200 chars): ${log.prompt?.substring(0, 200)}`);
                console.log(`Response Preview: ${log.response_preview}`);
            });
        }
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

readLogs();
