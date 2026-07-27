-- ============================================================
-- Migration: Add destek_turu column to technical_supports
-- ============================================================

ALTER TABLE public.technical_supports
ADD COLUMN IF NOT EXISTS destek_turu TEXT NOT NULL DEFAULT 'Online'
CHECK (destek_turu IN ('Online', 'Sahada'));
