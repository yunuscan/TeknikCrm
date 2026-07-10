-- ============================================================
-- TeknikCRM - Migration: Kullanıcı Silme İşlevi
-- Supabase Dashboard -> SQL Editor'de çalıştırın
-- ============================================================

-- 1. Profiles tablosundan silme (DELETE) politikası ekleniyor
-- Sadece 'Yonetici' (Yönetici) rolündeki kullanıcılar silebilir.
CREATE POLICY pol_profiles_delete
    ON public.profiles FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- 2. Profil silindiğinde auth.users tablosundaki kullanıcının da silinmesini sağlayan fonksiyon
CREATE OR REPLACE FUNCTION public.fn_delete_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- 3. Tetikleyici (Trigger) oluşturuluyor
CREATE OR REPLACE TRIGGER trg_on_profile_deleted
    AFTER DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_delete_auth_user();
