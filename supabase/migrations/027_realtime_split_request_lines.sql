-- Migration: 027_realtime_split_request_lines.sql
-- Description: enable postgres_changes realtime subscription on
-- split_request_lines so the SplitHistoryScreen can update without
-- refresh-on-focus.
--
-- REPLICA IDENTITY FULL is required so UPDATE events include the full
-- new row in the WAL payload — without it Supabase realtime only emits
-- the primary key, defeating the purpose (we'd have to refetch every
-- time).
--
-- RLS policies on split_request_lines (migration 023) gate which
-- subscribers receive which row updates: senders see updates for
-- their own splits, recipients see updates for their own line. No
-- additional auth setup needed.

ALTER TABLE public.split_request_lines REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.split_request_lines;
