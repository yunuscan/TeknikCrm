-- ============================================================
-- TeknikCRM - Veritabani Semasi
-- Supabase / PostgreSQL 15
-- Versiyon: 1.0.0
--
-- Kullanim: Supabase Dashboard -> SQL Editor'e yapiştırıp
-- "Run" butonuna basin.
-- ============================================================

-- ============================================================
-- YARDIMCI FONKSIYON: updated_at otomatik guncelleme
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================
-- TABLO: profiles
-- auth.users ile birebir iliskili kullanici profilleri
-- ============================================================

CREATE TABLE public.profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    phone       TEXT,
    role        TEXT        NOT NULL DEFAULT 'Stajyer'
                            CHECK (role IN ('Yonetici', 'Teknik Servis', 'Satis Personeli', 'Stajyer')),
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================
-- TABLO: customers
-- ============================================================

CREATE TABLE public.customers (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name        TEXT        NOT NULL,
    last_name         TEXT        NOT NULL,
    company_name      TEXT,
    tax_number        TEXT,
    tax_office        TEXT,
    phone             TEXT        NOT NULL,
    province          TEXT,
    district          TEXT,
    address           TEXT,
    authorized_person TEXT,
    notes             TEXT,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_customers_company_name ON public.customers (company_name);
CREATE INDEX idx_customers_phone        ON public.customers (phone);
CREATE INDEX idx_customers_is_active    ON public.customers (is_active);
CREATE INDEX idx_customers_created_by   ON public.customers (created_by);

-- ============================================================
-- TABLO: licenses
-- ============================================================

CREATE TABLE public.licenses (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    license_number    TEXT        NOT NULL UNIQUE,
    program_name      TEXT        NOT NULL,
    version           TEXT,
    sale_date         DATE,
    maintenance_start DATE,
    maintenance_end   DATE,
    created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_licenses_updated_at
    BEFORE UPDATE ON public.licenses
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_licenses_customer_id     ON public.licenses (customer_id);
CREATE INDEX idx_licenses_license_number  ON public.licenses (license_number);
CREATE INDEX idx_licenses_maintenance_end ON public.licenses (maintenance_end);

-- ============================================================
-- TABLO: tasks
-- ============================================================

CREATE TABLE public.tasks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    description TEXT,
    customer_id UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
    assigned_to UUID        REFERENCES public.profiles(id)  ON DELETE SET NULL,
    priority    TEXT        NOT NULL DEFAULT 'Orta'
                            CHECK (priority IN ('Dusuk', 'Orta', 'Yuksek')),
    start_date  DATE,
    end_date    DATE,
    start_time  TIME,
    end_time    TIME,
    status      TEXT        NOT NULL DEFAULT 'Bekliyor'
                            CHECK (status IN ('Bekliyor', 'Tamamlandi', 'Gecikti')),
    created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX idx_tasks_customer_id ON public.tasks (customer_id);
CREATE INDEX idx_tasks_status      ON public.tasks (status);
CREATE INDEX idx_tasks_end_date    ON public.tasks (end_date);
CREATE INDEX idx_tasks_priority    ON public.tasks (priority);

-- ============================================================
-- SEKANS VE TABLO: technical_supports
-- Benzersiz destek numarasi icin ayri sekans
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_support_number START WITH 1001 INCREMENT BY 1;

CREATE TABLE public.technical_supports (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    support_number BIGINT      NOT NULL UNIQUE DEFAULT nextval('public.seq_support_number'),
    customer_id    UUID        NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    caller_name    TEXT        NOT NULL,
    caller_phone   TEXT,
    subject        TEXT        NOT NULL,
    description    TEXT,
    assigned_to    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time       TIMESTAMPTZ,
    resolution     TEXT,
    status         TEXT        NOT NULL DEFAULT 'Acik'
                               CHECK (status IN ('Acik', 'Devam Ediyor', 'Cozuldu', 'Kapali')),
    notes          TEXT,
    servis_tipi    TEXT        NOT NULL DEFAULT 'Ucretsiz'
                               CHECK (servis_tipi IN ('Ucretli', 'Ucretsiz')),
    fiyat          NUMERIC(10, 2) DEFAULT NULL,
    odeme_durumu   TEXT        DEFAULT NULL
                               CHECK (odeme_durumu IS NULL OR odeme_durumu IN ('Odendi', 'Odenmedi')),
    created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_technical_supports_updated_at
    BEFORE UPDATE ON public.technical_supports
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_ts_customer_id    ON public.technical_supports (customer_id);
CREATE INDEX idx_ts_assigned_to    ON public.technical_supports (assigned_to);
CREATE INDEX idx_ts_status         ON public.technical_supports (status);
CREATE INDEX idx_ts_support_number ON public.technical_supports (support_number);
CREATE INDEX idx_ts_created_at     ON public.technical_supports (created_at DESC);

-- ============================================================
-- TABLO: support_logs
-- Destek kaydi uzerindeki zaman sirali log girisleri
-- ============================================================

CREATE TABLE public.support_logs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    support_id UUID        NOT NULL REFERENCES public.technical_supports(id) ON DELETE CASCADE,
    logged_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    log_entry  TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_logs_support_id ON public.support_logs (support_id);
CREATE INDEX idx_support_logs_created_at ON public.support_logs (created_at);

-- ============================================================
-- TABLO: visits
-- ============================================================

CREATE TABLE public.visits (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID        NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    address     TEXT,
    visit_date  DATE        NOT NULL,
    visit_time  TIME,
    assigned_to UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    purpose     TEXT,
    notes       TEXT,
    status      TEXT        NOT NULL DEFAULT 'Planlandi'
                            CHECK (status IN ('Planlandi', 'Tamamlandi')),
    work_done   TEXT,
    result      TEXT,
    created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_visits_updated_at
    BEFORE UPDATE ON public.visits
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_visits_customer_id ON public.visits (customer_id);
CREATE INDEX idx_visits_assigned_to ON public.visits (assigned_to);
CREATE INDEX idx_visits_visit_date  ON public.visits (visit_date);
CREATE INDEX idx_visits_status      ON public.visits (status);

-- ============================================================
-- TABLO: reminders
-- Gorev / ziyaret / destek ile iliskilendirilebilir hatirlaticilar.
-- Tek bir kaynak ile iliskili olmasi icin CHECK kisiti uygulanir.
-- ============================================================

CREATE TABLE public.reminders (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id              UUID        REFERENCES public.tasks(id)              ON DELETE CASCADE,
    visit_id             UUID        REFERENCES public.visits(id)             ON DELETE CASCADE,
    support_id           UUID        REFERENCES public.technical_supports(id) ON DELETE CASCADE,
    reminder_time        TIMESTAMPTZ NOT NULL,
    advance_notice       TEXT        NOT NULL
                                     CHECK (advance_notice IN ('30_dakika', '1_saat', '1_gun', '1_hafta')),
    notification_channel TEXT        NOT NULL
                                     CHECK (notification_channel IN ('Tarayici', 'Mail')),
    is_triggered         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reminders_single_source CHECK (
        (
            (task_id    IS NOT NULL)::INT +
            (visit_id   IS NOT NULL)::INT +
            (support_id IS NOT NULL)::INT
        ) = 1
    )
);

CREATE INDEX idx_reminders_task_id    ON public.reminders (task_id)       WHERE task_id IS NOT NULL;
CREATE INDEX idx_reminders_visit_id   ON public.reminders (visit_id)      WHERE visit_id IS NOT NULL;
CREATE INDEX idx_reminders_support_id ON public.reminders (support_id)    WHERE support_id IS NOT NULL;
CREATE INDEX idx_reminders_time_active ON public.reminders (reminder_time) WHERE is_triggered = FALSE;

-- ============================================================
-- FONKSIYON: Yeni auth kullanicisi kaydolunca profil olustur
-- SECURITY DEFINER ile RLS'yi atlayarak dogrudan ekler.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'Stajyer')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders          ENABLE ROW LEVEL SECURITY;

-- Yardimci: Mevcut kullanicinin rolunu dondur (STABLE ile sorgu planlamasi optimize edilir)
CREATE OR REPLACE FUNCTION public.fn_get_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ---- profiles ----
CREATE POLICY pol_profiles_select
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_profiles_update
    ON public.profiles FOR UPDATE
    USING (id = auth.uid() OR public.fn_get_role() = 'Yonetici')
    WITH CHECK (id = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_profiles_insert
    ON public.profiles FOR INSERT
    WITH CHECK (public.fn_get_role() = 'Yonetici');

-- ---- customers ----
CREATE POLICY pol_customers_select
    ON public.customers FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_customers_insert
    ON public.customers FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Satis Personeli', 'Teknik Servis'));

CREATE POLICY pol_customers_update
    ON public.customers FOR UPDATE
    USING (public.fn_get_role() IN ('Yonetici', 'Satis Personeli', 'Teknik Servis'));

CREATE POLICY pol_customers_delete
    ON public.customers FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- ---- licenses ----
CREATE POLICY pol_licenses_select
    ON public.licenses FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_licenses_insert
    ON public.licenses FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Satis Personeli'));

CREATE POLICY pol_licenses_update
    ON public.licenses FOR UPDATE
    USING (public.fn_get_role() IN ('Yonetici', 'Satis Personeli'));

CREATE POLICY pol_licenses_delete
    ON public.licenses FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- ---- tasks ----
CREATE POLICY pol_tasks_select
    ON public.tasks FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_tasks_insert
    ON public.tasks FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Teknik Servis', 'Satis Personeli'));

CREATE POLICY pol_tasks_update
    ON public.tasks FOR UPDATE
    USING (assigned_to = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_tasks_delete
    ON public.tasks FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- ---- technical_supports ----
CREATE POLICY pol_ts_select
    ON public.technical_supports FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_ts_insert
    ON public.technical_supports FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Teknik Servis'));

CREATE POLICY pol_ts_update
    ON public.technical_supports FOR UPDATE
    USING (assigned_to = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_ts_delete
    ON public.technical_supports FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- ---- support_logs ----
CREATE POLICY pol_support_logs_select
    ON public.support_logs FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_support_logs_insert
    ON public.support_logs FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Teknik Servis'));

-- ---- visits ----
CREATE POLICY pol_visits_select
    ON public.visits FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY pol_visits_insert
    ON public.visits FOR INSERT
    WITH CHECK (public.fn_get_role() IN ('Yonetici', 'Teknik Servis', 'Satis Personeli'));

CREATE POLICY pol_visits_update
    ON public.visits FOR UPDATE
    USING (assigned_to = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_visits_delete
    ON public.visits FOR DELETE
    USING (public.fn_get_role() = 'Yonetici');

-- ---- reminders ----
CREATE POLICY pol_reminders_select
    ON public.reminders FOR SELECT
    USING (created_by = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_reminders_insert
    ON public.reminders FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pol_reminders_update
    ON public.reminders FOR UPDATE
    USING (created_by = auth.uid() OR public.fn_get_role() = 'Yonetici');

CREATE POLICY pol_reminders_delete
    ON public.reminders FOR DELETE
    USING (created_by = auth.uid() OR public.fn_get_role() = 'Yonetici');
