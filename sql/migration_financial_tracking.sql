-- ============================================================
-- TeknikCRM - Migration: Finansal Takip Alanları
-- Supabase Dashboard -> SQL Editor'de çalıştırın
-- ============================================================

-- Yeni kolonlar ekleniyor
ALTER TABLE public.technical_supports
  ADD COLUMN IF NOT EXISTS servis_tipi TEXT NOT NULL DEFAULT 'Ucretsiz'
    CHECK (servis_tipi IN ('Ucretli', 'Ucretsiz'));

ALTER TABLE public.technical_supports
  ADD COLUMN IF NOT EXISTS fiyat NUMERIC(10, 2) DEFAULT NULL;

ALTER TABLE public.technical_supports
  ADD COLUMN IF NOT EXISTS odeme_durumu TEXT DEFAULT NULL
    CHECK (odeme_durumu IS NULL OR odeme_durumu IN ('Odendi', 'Odenmedi'));

-- Opsiyonel: Mevcut notes alanındaki [FEE:] etiketlerinden
-- veri migrasyonu yapmak isterseniz aşağıdaki sorguları çalıştırın:
--
-- UPDATE public.technical_supports
-- SET odeme_durumu = 'Odendi', servis_tipi = 'Ucretli'
-- WHERE notes LIKE '%[FEE:Ödendi]%';
--
-- UPDATE public.technical_supports
-- SET odeme_durumu = 'Odenmedi', servis_tipi = 'Ucretli'
-- WHERE notes LIKE '%[FEE:Ödenmedi]%';
