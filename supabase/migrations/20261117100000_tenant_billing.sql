-- Operator subscription: what each business has paid the platform (set-up fee and monthly fee).
--
-- One row per business. Written ONLY by the server with the service-role key (the Operator app's
-- /api/billing routes, after checking the payment with Stripe); no staff login can write it.
-- Staff read their own business's row through my_billing(), which also returns the fees that
-- apply (the business's own rate, or the platform default). Additive: nothing existing changes.

create table if not exists public.tenant_billing (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  status text not null default 'none' check (status in ('none', 'active', 'past_due', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  setup_paid_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_invoice_number text,
  last_invoice_paid_at timestamptz,
  last_invoice_amount_pence integer check (last_invoice_amount_pence is null or last_invoice_amount_pence >= 0),
  updated_at timestamptz not null default now()
);

alter table public.tenant_billing enable row level security;
revoke all on public.tenant_billing from public, anon, authenticated;
grant select, insert, update, delete on public.tenant_billing to service_role;

create unique index if not exists tenant_billing_customer_key on public.tenant_billing (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists tenant_billing_subscription_key on public.tenant_billing (stripe_subscription_id) where stripe_subscription_id is not null;

-- The signed-in staff member's own business: its subscription state and the fees that apply.
-- A platform owner (no business of their own) gets null.
create or replace function public.my_billing()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
  v_out jsonb;
begin
  select tu.tenant_id into v_tenant
    from public.tenant_users tu
   where tu.user_id = auth.uid()
     and tu.tenant_id is not null
     and tu.role in ('operator_admin', 'dispatcher')
   order by (tu.role = 'operator_admin') desc
   limit 1;
  if v_tenant is null then
    return null;
  end if;

  select jsonb_build_object(
           'tenant_id', t.id,
           'monthly_pence', coalesce(t.monthly_fee_pence, f.default_monthly_pence),
           'setup_pence', coalesce(t.setup_fee_pence, f.default_setup_pence),
           'status', coalesce(b.status, 'none'),
           'setup_paid_at', b.setup_paid_at,
           'current_period_end', b.current_period_end,
           'cancel_at_period_end', coalesce(b.cancel_at_period_end, false),
           'last_invoice_number', b.last_invoice_number,
           'last_invoice_paid_at', b.last_invoice_paid_at,
           'last_invoice_amount_pence', b.last_invoice_amount_pence
         )
    into v_out
    from public.tenants t
    cross join public.platform_fees f
    left join public.tenant_billing b on b.tenant_id = t.id
   where t.id = v_tenant and f.id;
  return v_out;
end;
$$;

revoke all on function public.my_billing() from public, anon;
grant execute on function public.my_billing() to authenticated, service_role;
