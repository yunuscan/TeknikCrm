-- ============================================================
-- TeknikCRM - Araçlar / Programlar & Link Dosya Yönetimi Migrasyonu
-- ============================================================

-- 1. TABLO: tools
CREATE TABLE IF NOT EXISTS public.tools (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    description    TEXT,
    category       TEXT        NOT NULL DEFAULT 'Genel',
    tool_type      TEXT        NOT NULL DEFAULT 'file' CHECK (tool_type IN ('file', 'link')),
    file_name      TEXT,
    file_path      TEXT,
    external_url   TEXT,
    file_size      BIGINT      NOT NULL DEFAULT 0,
    mime_type      TEXT,
    download_count INT         NOT NULL DEFAULT 0,
    created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Varolan tablo varsa sütunları ekle/güncelle
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS tool_type TEXT NOT NULL DEFAULT 'file' CHECK (tool_type IN ('file', 'link'));
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.tools ALTER COLUMN file_name DROP NOT NULL;
ALTER TABLE public.tools ALTER COLUMN file_path DROP NOT NULL;

-- Trigger: updated_at guncelleme
DROP TRIGGER IF EXISTS trg_tools_updated_at ON public.tools;
CREATE TRIGGER trg_tools_updated_at
    BEFORE UPDATE ON public.tools
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_tools_category   ON public.tools (category);
CREATE INDEX IF NOT EXISTS idx_tools_tool_type  ON public.tools (tool_type);
CREATE INDEX IF NOT EXISTS idx_tools_created_at ON public.tools (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tools_created_by ON public.tools (created_by);

-- 2. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tools_select ON public.tools;
CREATE POLICY pol_tools_select
    ON public.tools FOR SELECT
    USING (true);

DROP POLICY IF EXISTS pol_tools_insert ON public.tools;
CREATE POLICY pol_tools_insert
    ON public.tools FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS pol_tools_update ON public.tools;
CREATE POLICY pol_tools_update
    ON public.tools FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS pol_tools_delete ON public.tools;
CREATE POLICY pol_tools_delete
    ON public.tools FOR DELETE
    USING (
        created_by = auth.uid() 
        OR public.fn_get_role() IN ('Yonetici', 'Yönetici', 'Teknik Servis')
    );

-- 3. SUPABASE STORAGE BUCKET VE POLICIES ('tools' BUCKET'I ICIN)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tools', 'tools', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Read Access for Tools'
    ) THEN
        CREATE POLICY "Public Read Access for Tools" ON storage.objects FOR SELECT USING (bucket_id = 'tools');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated Users Upload Tools'
    ) THEN
        CREATE POLICY "Authenticated Users Upload Tools" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tools' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated Users Delete Tools'
    ) THEN
        CREATE POLICY "Authenticated Users Delete Tools" ON storage.objects FOR DELETE USING (bucket_id = 'tools' AND auth.role() = 'authenticated');
    END IF;
END $$;
