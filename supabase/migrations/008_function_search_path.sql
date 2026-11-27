-- On Supabase, extensions such as citext and pgcrypto (gen_random_bytes) are
-- installed in the "extensions" schema. The registration functions pin
-- search_path to "public" only, so they cannot find citext / gen_random_bytes.
-- This adds "extensions" to their search path. Safe to run more than once.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'begin_cashfree_event_registration', 'attach_cashfree_order',
      'confirm_cashfree_event_registration', 'cancel_cashfree_registration',
      'register_for_event', 'new_event_registration_code', 'clean_event_answers',
      'admin_review_event_payment', 'admin_add_event_registration', 'admin_cancel_event_registration',
      'sync_event_registered_count', 'touch_event_registration', 'log_event_change', 'log_event_delete'
    )
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;
