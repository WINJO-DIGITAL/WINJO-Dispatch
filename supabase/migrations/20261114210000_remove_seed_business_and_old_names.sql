-- Remove the seeded business and the old names (14/11/2026, owner instruction: nothing in the
-- platform belongs to an earlier product).
--
-- 1. New rows get their business from the signed-in person (private.my_tenant_id()) instead of a
--    built-in default business. A row inserted with no business and no signed-in person is refused.
-- 2. The helper functions lose their old names (html_escape, notification_email) and their
--    default-business fallbacks; the backup function that pointed at another project is dropped.
-- 3. Push subject, reference prefix default and new-customer profiles no longer name a default
--    business. A new account with no business gets no customer profile.
-- 4. The seeded business and its leftover rows are removed (only if it is still the one called 'ev-exec').
--
-- Not applied to live until the owner approves it.

create or replace function private.my_tenant_id()
 returns uuid
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $fn$
  select tu.tenant_id
  from public.tenant_users tu
  where tu.user_id = auth.uid() and tu.tenant_id is not null
  order by tu.tenant_id
  limit 1
$fn$;
revoke all on function private.my_tenant_id() from public;
grant execute on function private.my_tenant_id() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.html_escape(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select replace(replace(replace(coalesce(p,''),'&','&amp;'),'<','&lt;'),'>','&gt;')
$function$
;
revoke all on function public.html_escape(text) from public, anon, authenticated, service_role;
grant execute on function public.html_escape(text) to service_role;

CREATE OR REPLACE FUNCTION public.enqueue_operator_customer_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_phone   text := nullif(trim(new.customer_phone), '');
  v_email   text := nullif(trim(new.customer_email), '');
  v_name    text := coalesce(nullif(trim(new.customer_name), ''), 'there');
  v_first   text := coalesce(nullif(split_part(trim(coalesce(new.customer_name, '')), ' ', 1), ''), 'there');
  v_timetxt text;
  v_status  text := lower(coalesce(new.payment_status, ''));
  v_did     uuid := coalesce(new.assigned_driver_id, new.driver_id);
  v_msg     text; v_conf text; v_ch text;
  v_is_operator boolean := coalesce(new.source, 'website') = 'operator';
  v_reminder_type text;
  v_rows    jsonb;
  v_html    text;
  v_drv_name text; v_drv_vehicle text;
  -- This business's own name and number (never another business's).
  v_b       jsonb := public.tenant_brand(new.tenant_id);
  v_biz     text  := nullif(v_b->>'name', '');
  v_bn      text  := coalesce(v_biz || ' ', '');
  v_pre     text  := coalesce(v_biz || ': ', '');
  v_foot    text  := case when nullif(v_b->>'phone', '') is not null
                          then 'Questions? Call or WhatsApp ' || (v_b->>'phone') || '.' end;
begin
  if v_phone is null and v_email is null then return new; end if;

  v_ch := case when v_email is not null then 'email'
               when v_phone is not null then 'sms'
               else null end;

  v_timetxt := coalesce(
    to_char(new.pickup_time at time zone 'Europe/London', 'DD/MM/YYYY HH24:MI'),
    nullif(btrim(coalesce(to_char(new.travel_date, 'DD/MM/YYYY'), '')
                 || ' ' || coalesce(left(new.travel_time::text, 5), '')), '')
  );

  if v_did is not null then
    select nullif(trim(d.full_name), ''),
           nullif(btrim(coalesce(d.vehicle_model, '') || ' ' || coalesce(upper(d.vehicle_registration), '')), '')
      into v_drv_name, v_drv_vehicle
      from drivers d where d.id = v_did;
  end if;

  v_rows := jsonb_build_array(
    jsonb_build_object('label', 'Reference', 'value', new.ref),
    jsonb_build_object('label', 'Pickup',    'value', coalesce(nullif(new.pickup_location, ''), new.airport)),
    jsonb_build_object('label', 'Drop-off',  'value', coalesce(nullif(new.dropoff_address, ''),
                                                      case when nullif(new.pickup_location, '') is not null then new.airport end)),
    jsonb_build_object('label', 'Date & time', 'value', v_timetxt),
    jsonb_build_object('label', 'Flight',    'value', upper(nullif(new.flight_number, '')))
  );

  if tg_op = 'INSERT' then
    if v_is_operator and v_ch is not null
       and coalesce(new.notes, '') !~* '^Return leg created automatically' then
      v_conf := v_pre || 'Hi ' || v_name || ', your airport transfer' || coalesce(' (' || v_timetxt || ')','') || ' is booked. Ref ' || new.ref || '.';

      if not exists (select 1 from notification_queue q where q.booking_id=new.id and q.type='received')
         and not exists (select 1 from notification_log   l where l.booking_id=new.id and l.type='received')
         and not exists (select 1 from operator_sms_tasks  t where t.booking_id=new.id and t.kind='confirmation') then
        if v_ch='email' then
          v_html := tenant_notification_email(new.tenant_id, 
            'Booking confirmed', '#fbf3e0', '#8a6516',
            'Hi ' || html_escape(v_first) || ', your airport transfer is booked. We look forward to seeing you.',
            v_rows, v_foot);
          insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
          values (gen_random_uuid(),new.id,'received','email',v_email,'Your '||v_bn||'airport transfer is booked (Ref '||new.ref||')',v_conf,v_html,'pending',0,now(),now());
        else
          insert into public.operator_sms_tasks (tenant_id, booking_id, kind, customer_name, customer_phone, message, status)
          values (new.tenant_id, new.id, 'confirmation', v_name, v_phone, v_conf, 'pending')
          on conflict (booking_id, kind) do nothing;
        end if;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status='En Route' and old.status='Dispatched' then
        v_msg := v_pre||'your driver is on the way. Ref '||new.ref||'.';
        v_reminder_type := 'en_route';
        v_html := tenant_notification_email(new.tenant_id, 
          'Driver on the way', '#e6effb', '#1e4a8a',
          'Hi ' || html_escape(v_first) || ', your driver is now on the way to your pickup point.',
          v_rows || jsonb_build_array(
            jsonb_build_object('label', 'Driver',  'value', v_drv_name),
            jsonb_build_object('label', 'Vehicle', 'value', v_drv_vehicle)),
          v_foot);
      elsif new.status='Arrived' and old.status='En Route' then
        v_msg := v_pre||'your driver has arrived at the pickup point. Ref '||new.ref||'.';
        v_reminder_type := 'arrived';
        v_html := tenant_notification_email(new.tenant_id, 
          'Driver arrived', '#dcfce7', '#166534',
          'Hi ' || html_escape(v_first) || ', your driver has arrived at your pickup point and is ready when you are.',
          v_rows || jsonb_build_array(
            jsonb_build_object('label', 'Driver',  'value', v_drv_name),
            jsonb_build_object('label', 'Vehicle', 'value', v_drv_vehicle)),
          v_foot);
      elsif new.status='Cancelled' and old.status<>'Completed'
            and not (new.operator_response = 'rejected'
                     and old.operator_response is distinct from new.operator_response) then
        v_msg := v_pre||'your booking '||new.ref||' has been cancelled. Please contact us if this is unexpected.';
        v_reminder_type := 'cancelled';
        v_html := tenant_notification_email(new.tenant_id, 
          'Booking cancelled', '#fee2e2', '#991b1b',
          'Hi ' || html_escape(v_first) || ', your booking has been cancelled. If this is unexpected, please get in touch.',
          v_rows, v_foot);
      else v_msg := null; end if;

      if v_msg is not null and v_ch is not null then
        if v_ch='email' then
          insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
          values (gen_random_uuid(),new.id,'status_update','email',v_email,'Update on your '||v_bn||'transfer (Ref '||new.ref||')',v_msg,v_html,'pending',0,now(),now());
        elsif v_reminder_type in ('en_route', 'arrived') then
          null;
        else
          -- No email: the office sends the cancellation text (Today -> Texts to send).
          insert into public.operator_sms_tasks
            (tenant_id, booking_id, kind, customer_name, customer_phone, message, status)
          values
            (new.tenant_id, new.id, 'cancellation', v_name, v_phone, v_msg, 'pending')
          on conflict (booking_id, kind) do nothing;
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.tenant_notification_email(p_tenant uuid, p_pill text, p_pill_bg text, p_pill_fg text, p_lead text, p_rows jsonb, p_footnote text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
     '<!doctype html><html lang="en"><head>'
  || '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  || '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
  || '<style>:root{color-scheme:light;supported-color-schemes:light}</style></head>'
  || '<body style="margin:0;background:#E9EBF2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f1b33">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#E9EBF2" style="background:#E9EBF2"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e5ee">'
  || '<tr><td bgcolor="#0B132B" style="background:#0B132B;padding:22px 28px">'
  ||   '<div style="color:#d7a23f;font-size:20px;font-weight:800;letter-spacing:.22em">' || html_escape(b.v->>'wordmark') || '</div>'
  || '</td></tr>'
  || '<tr><td bgcolor="#C9A550" style="background:#C9A550;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>'
  || '<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:26px 28px">'
  ||   '<span style="display:inline-block;background:' || p_pill_bg || ';color:' || p_pill_fg || ';border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700">' || p_pill || '</span>'
  ||   '<p style="margin:18px 0 16px;font-size:15px;line-height:1.6;color:#0f1b33">' || p_lead || '</p>'
  ||   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0">'
  ||   coalesce((
         select string_agg(
                  '<tr><td style="padding:9px 0;color:#64748b;width:118px;border-bottom:1px solid #eef0f3;font-size:12px;text-transform:uppercase;letter-spacing:.04em;vertical-align:top">'
                  || html_escape(e->>'label')
                  || '</td><td style="padding:9px 0;font-weight:700;color:#0f1b33;border-bottom:1px solid #eef0f3;font-size:14px;vertical-align:top">'
                  || html_escape(e->>'value') || '</td></tr>',
                  '' order by ord)
         from jsonb_array_elements(p_rows) with ordinality as t(e, ord)
         where nullif(btrim(e->>'value'),'') is not null
       ),'')
  ||   '</table>'
  ||   case when nullif(btrim(coalesce(p_footnote,'')),'') is not null
            then '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#475569">' || p_footnote || '</p>'
            else '' end
  || '</td></tr>'
  || '<tr><td bgcolor="#0B132B" style="background:#0B132B;padding:14px 28px;color:#9aa3b2;font-size:11px">'
  ||   html_escape(concat_ws(' · ', nullif(b.v->>'name',''), nullif(b.v->>'tagline',''), nullif(b.v->>'phone',''), nullif(b.v->>'email',''), nullif(b.v->>'domain','')))
  ||   case when nullif(b.v->>'licence','') is not null then '<br>Private hire operator licence ' || html_escape(b.v->>'licence') else '' end
  ||   '</td></tr>'
  || '</table></td></tr></table></body></html>'
  from (select public.tenant_brand(p_tenant) as v) b
$function$
;
CREATE OR REPLACE FUNCTION public.tenant_brand(p_tenant uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with t as (
    select t.name, t.contact_email, t.contact_phone, t.brand
    from public.tenants t
    where t.id = p_tenant
  ),
  p as (
    select t.*,
           regexp_replace(coalesce(t.contact_phone, ''), '[\s()-]', '', 'g') as digits
    from t
  ),
  n as (
    select p.*,
           case when p.digits like '+44%'  then '0' || substr(p.digits, 4)
                when p.digits like '0044%' then '0' || substr(p.digits, 5)
                else p.digits end as national
    from p
  )
  select jsonb_build_object(
    'name',     btrim(coalesce(n.name, '')),
    'wordmark', upper(btrim(coalesce(n.name, ''))),
    'phone',    case when n.national ~ '^07[0-9]{9}$' then substr(n.national, 1, 5) || ' ' || substr(n.national, 6)
                     else btrim(coalesce(n.contact_phone, '')) end,
    'email',    btrim(coalesce(n.contact_email, '')),
    'domain',   case when coalesce(n.brand->>'site_url', '') ~* '^https?://'
                     then regexp_replace(regexp_replace(btrim(n.brand->>'site_url'), '^https?://', '', 'i'), '/+$', '')
                     else '' end,
    'tagline',  btrim(coalesce(n.brand->>'tagline', '')),
    'licence',  btrim(coalesce(n.brand->>'licence', ''))
  )
  from n
  union all
  select jsonb_build_object('name','','wordmark','','phone','','email','','domain','','tagline','','licence','')
  where not exists (select 1 from t)
  limit 1
$function$
;
CREATE OR REPLACE FUNCTION private.set_audit_log_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.tenant_id is null then
    new.tenant_id := (select tu.tenant_id from public.tenant_users tu where tu.user_id = new.actor_id and tu.tenant_id is not null limit 1);
  end if;
  -- An action by someone with no business of their own (the platform owner) is not filed under any business.
  if new.tenant_id is null then return null; end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_raw text := NEW.raw_user_meta_data->>'tenant_id';
  v_tenant uuid;
begin
  if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_tenant from public.tenants where id = v_raw::uuid and status = 'active';
  end if;

  -- A customer profile belongs to a business. An account made with no business (staff, drivers,
  -- the platform owner) gets none.
  if v_tenant is not null then
    insert into public.profiles (id, full_name, tenant_id)
    values (NEW.id, NEW.raw_user_meta_data->>'full_name', v_tenant)
    on conflict (id) do nothing;
  end if;
  return NEW;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_push_dispatch_bundle(p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c public.push_config; v jsonb;
begin
  select * into c from public.push_config where id = true;
  if c.webhook_secret is null or p_secret is distinct from c.webhook_secret then
    return null;
  end if;
  select jsonb_build_object(
    'vapid_public',  c.vapid_public,
    'vapid_private', c.vapid_private,
    'vapid_subject', coalesce(c.vapid_subject, 'mailto:hello@winjodigital.co.uk'),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.operator_push_subscriptions s
      where exists (
        select 1 from public.tenant_users tu
        where tu.user_id = s.user_id
          and tu.role in ('super_admin', 'operator_admin', 'dispatcher')
      )), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_push_dispatch_bundle_for_tenant(p_secret text, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare c public.push_config; v jsonb;
begin
  select * into c from public.push_config where id = true;
  if c.webhook_secret is null or p_secret is distinct from c.webhook_secret then
    return null;
  end if;
  if p_tenant_id is null then
    return null; -- the caller must say which business the alert is for
  end if;
  select jsonb_build_object(
    'vapid_public',  c.vapid_public,
    'vapid_private', c.vapid_private,
    'vapid_subject', coalesce(c.vapid_subject, 'mailto:hello@winjodigital.co.uk'),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.operator_push_subscriptions s
      where (s.tenant_id = p_tenant_id or s.tenant_id is null)
        and exists (
          select 1 from public.tenant_users tu
          where tu.user_id = s.user_id
            and tu.role in ('super_admin', 'operator_admin', 'dispatcher')
        )), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$
;
-- New rows get the business of the signed-in person, not a built-in default business.
alter table public.audit_log alter column tenant_id set default private.my_tenant_id();
alter table public.bookings alter column tenant_id set default private.my_tenant_id();
alter table public.contact_messages alter column tenant_id set default private.my_tenant_id();
alter table public.driver_sms_reminders alter column tenant_id set default private.my_tenant_id();
alter table public.drivers alter column tenant_id set default private.my_tenant_id();
alter table public.error_log alter column tenant_id set default private.my_tenant_id();
alter table public.flight_verification_settings alter column tenant_id set default private.my_tenant_id();
alter table public.flight_verifications alter column tenant_id set default private.my_tenant_id();
alter table public.invoices alter column tenant_id set default private.my_tenant_id();
alter table public.missed_calls alter column tenant_id set default private.my_tenant_id();
alter table public.notification_log alter column tenant_id set default private.my_tenant_id();
alter table public.notification_queue alter column tenant_id set default private.my_tenant_id();
alter table public.operator_sms_tasks alter column tenant_id set default private.my_tenant_id();
alter table public.points_transactions alter column tenant_id set default private.my_tenant_id();
alter table public.profiles alter column tenant_id set default private.my_tenant_id();
alter table public.quote_requests alter column tenant_id set default private.my_tenant_id();
alter table public.reviews alter column tenant_id set default private.my_tenant_id();

alter table public.tenants alter column ref_prefix set default 'WJD';

-- The old names and the backup function that pointed at another project.
drop function if exists public.evexec_notification_email(text, text, text, text, jsonb, text);
drop function if exists public.evexec_esc(text);
drop function if exists private.run_evexec_backup();

-- The seeded business and anything filed under it (a test booking and an automatic profile).
do $do$
declare
  v_seed uuid;
  r record;
begin
  select id into v_seed from public.tenants where slug = 'ev-exec';
  if v_seed is null then return; end if;
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and c.table_name <> 'tenants'
  loop
    execute format('delete from public.%I where tenant_id = %L', r.table_name, v_seed);
  end loop;
  delete from public.tenants where id = v_seed;
end
$do$;
