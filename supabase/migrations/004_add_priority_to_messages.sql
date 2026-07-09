-- Persist announcement priority (previously accepted by the app but dropped).
-- 'normal' | 'urgent'. Default keeps every existing row and every legacy
-- writer (e.g. older mobile-app builds) valid without code changes.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.messages
  ADD CONSTRAINT messages_priority_check
  CHECK (priority IN ('normal', 'urgent'));
