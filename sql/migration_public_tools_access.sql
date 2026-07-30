-- ============================================================
-- TeknikCRM - Giriş Yapmadan Araçlar & İndirmeler Erişim Migrasyonu
-- ============================================================

-- 1. Araçlar tablosunda anonim (giriş yapmamış) kullanıcılar için okuma izni
DROP POLICY IF EXISTS pol_tools_select ON public.tools;
CREATE POLICY pol_tools_select
    ON public.tools FOR SELECT
    USING (true);

-- 2. İndirme sayacını güncelleyebilmek için anonim kullanıcılara da güncelleme izni
DROP POLICY IF EXISTS pol_tools_update ON public.tools;
CREATE POLICY pol_tools_update
    ON public.tools FOR UPDATE
    USING (true);
