-- Self-serve sign-up (applied to the platform database 14/11/2026 with the owner's approval; kept here until the baseline is rebuilt).
--
-- A business applies on the website (/signup): its details and its acceptance of the Operator
-- Services Agreement and Schedule A are stored here by the website's server (service role).
-- Nothing is created for the business until the platform owner has confirmed the set-up fee
-- is paid and approves the application, which creates the business with provision_tenant().
--
-- Flow: awaiting_payment -> paid -> approved, or rejected from either of the first two.
-- Nobody but the platform owner (super_admin) can read or change an application, and the
-- applicant is never given a login by this migration.

create table public.signup_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'approved', 'rejected')),
  business_name text not null check (length(btrim(business_name)) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 40),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 100),
  contact_email text not null check (contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 40),
  message text check (message is null or length(message) <= 1000),
  contract_version text not null,
  responsibilities_version text not null,
  terms_accepted_at timestamptz not null default now(),
  setup_pence integer not null check (setup_pence between 0 and 10000000),
  monthly_pence integer not null check (monthly_pence between 0 and 1000000),
  paid_at timestamptz,
  paid_note text check (paid_note is null or length(paid_note) <= 300),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  tenant_id uuid references public.tenants(id)
);

-- A short name can be wanted by only one open application at a time.
create unique index signup_applications_open_slug on public.signup_applications (slug)
  where status in ('awaiting_payment', 'paid', 'approved');

alter table public.signup_applications enable row level security;
revoke all on public.signup_applications from public, anon, authenticated;
grant select, insert, update on public.signup_applications to service_role;

create or replace function public.list_signup_applications()
returns setof public.signup_applications
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not private.is_super_admin() then
    raise exception 'Only the platform owner can see applications' using errcode = '42501';
  end if;
  return query select * from public.signup_applications order by created_at desc;
end;
$fn$;

create or replace function public.mark_signup_paid(p_id uuid, p_note text default null)
returns public.signup_applications
language plpgsql
security definer
set search_path = public
as $fn$
declare a public.signup_applications;
begin
  if not private.is_super_admin() then
    raise exception 'Only the platform owner can confirm payment' using errcode = '42501';
  end if;
  update public.signup_applications
     set status = 'paid', paid_at = now(), paid_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id and status = 'awaiting_payment'
  returning * into a;
  if a.id is null then
    raise exception 'That application is not waiting for payment' using errcode = 'P0002';
  end if;
  return a;
end;
$fn$;

create or replace function public.approve_signup_application(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.signup_applications;
  t public.tenants;
begin
  if not private.is_super_admin() then
    raise exception 'Only the platform owner can approve an application' using errcode = '42501';
  end if;
  select * into a from public.signup_applications where id = p_id for update;
  if a.id is null then
    raise exception 'Unknown application' using errcode = 'P0002';
  end if;
  if a.status = 'approved' then
    raise exception 'That application is already approved' using errcode = '22023';
  end if;
  if a.status = 'rejected' then
    raise exception 'That application was rejected' using errcode = '22023';
  end if;
  if a.status <> 'paid' and a.setup_pence > 0 then
    raise exception 'Confirm the set-up fee is paid before approving' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants where slug = a.slug) then
    raise exception 'A business already uses the short name "%"', a.slug using errcode = '23505';
  end if;

  t := public.provision_tenant(a.slug, a.business_name, a.contact_email, a.contact_phone);

  update public.signup_applications
     set status = 'approved', tenant_id = t.id, decided_at = now(), decided_by = auth.uid()
   where id = a.id;
  return jsonb_build_object('tenant_id', t.id, 'slug', t.slug, 'application_id', a.id);
end;
$fn$;

create or replace function public.reject_signup_application(p_id uuid, p_note text default null)
returns public.signup_applications
language plpgsql
security definer
set search_path = public
as $fn$
declare a public.signup_applications;
begin
  if not private.is_super_admin() then
    raise exception 'Only the platform owner can reject an application' using errcode = '42501';
  end if;
  update public.signup_applications
     set status = 'rejected', decided_at = now(), decided_by = auth.uid(), decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id and status in ('awaiting_payment', 'paid')
  returning * into a;
  if a.id is null then
    raise exception 'That application cannot be rejected' using errcode = 'P0002';
  end if;
  return a;
end;
$fn$;

revoke all on function public.list_signup_applications() from public, anon;
revoke all on function public.mark_signup_paid(uuid, text) from public, anon;
revoke all on function public.approve_signup_application(uuid) from public, anon;
revoke all on function public.reject_signup_application(uuid, text) from public, anon;
grant execute on function public.list_signup_applications() to authenticated, service_role;
grant execute on function public.mark_signup_paid(uuid, text) to authenticated, service_role;
grant execute on function public.approve_signup_application(uuid) to authenticated, service_role;
grant execute on function public.reject_signup_application(uuid, text) to authenticated, service_role;
