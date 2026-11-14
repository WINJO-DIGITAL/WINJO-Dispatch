-- Operator push notifications (new bookings and no-shows) now go to the new Operator app
-- on the platform's own address, not the old EV Exec operator app. Only the URL changes;
-- the shared secret (push_config) is unchanged and is checked by the new app's route.

create or replace function public.notify_operator_new_booking()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_secret text;
begin
  if coalesce(new.source, 'website') <> 'website' then return new; end if;
  select webhook_secret into v_secret from public.push_config where id = true;
  if v_secret is null then return new; end if;
  perform net.http_post(
    url     := 'https://winjo-dispatch.vercel.app/api/push/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$function$;

create or replace function public.notify_operator_no_show()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_secret text; v_driver text; v_when text; v_where text;
begin
  if not ((new.status = 'No Show' and old.status is distinct from 'No Show')
    or (new.status = 'Cancelled' and old.status is distinct from 'Cancelled'
        and coalesce(new.driver_notes, '') like '%[No Show]%')) then return new; end if;
  begin
    select webhook_secret into v_secret from public.push_config where id = true;
    if v_secret is null then return new; end if;
    select coalesce(nullif(d.full_name, ''), d.name) into v_driver from public.drivers d where d.id = new.assigned_driver_id;
    v_when  := concat_ws(' ', left(new.travel_time, 5), to_char(new.travel_date, 'DD/MM/YYYY'));
    v_where := coalesce(nullif(new.pickup_location, ''), new.airport);
    perform net.http_post(
      url := 'https://winjo-dispatch.vercel.app/api/push/dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      body := jsonb_build_object(
        'tenant_id', new.tenant_id,
        'notification', jsonb_build_object(
          'title', 'No-show: ' || coalesce(new.customer_name, 'customer'),
          'body',  concat_ws(' · ', v_where, nullif(v_when, ''), 'Driver ' || v_driver, 'Ref ' || new.ref),
          'url',   '/operator/bookings?q=' || new.ref,
          'tag',   'noshow-' || new.ref)));
  exception when others then null; -- An alert must never stop the driver recording the no-show.
  end;
  return new;
end; $function$;
