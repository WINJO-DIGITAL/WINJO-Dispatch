-- Operator subscription records. Rolls back; creates its own fixtures.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create temp table biz as select id, 'a'::text as k from public.provision_tenant('billing-a', 'Billing A Co')
  union all select id, 'b' from public.provision_tenant('billing-b', 'Billing B Co');
grant select on biz to public;
insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-000000000041', 'super@billing.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000042', 'admin-a@billing.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000043', 'dispatch-a@billing.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000044', 'admin-b@billing.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000045', 'driver-a@billing.invalid');
insert into public.tenant_users (tenant_id, user_id, role) values
  (null, 'eeeeeeee-0000-4000-8000-000000000041', 'super_admin'),
  ((select id from biz where k = 'a'), 'eeeeeeee-0000-4000-8000-000000000042', 'operator_admin'),
  ((select id from biz where k = 'a'), 'eeeeeeee-0000-4000-8000-000000000043', 'dispatcher'),
  ((select id from biz where k = 'b'), 'eeeeeeee-0000-4000-8000-000000000044', 'operator_admin'),
  ((select id from biz where k = 'a'), 'eeeeeeee-0000-4000-8000-000000000045', 'driver');

-- The server records a payment for business A (service role).
insert into public.tenant_billing (tenant_id, status, stripe_customer_id, stripe_subscription_id, setup_paid_at, current_period_end, last_invoice_number, last_invoice_paid_at, last_invoice_amount_pence)
values ((select id from biz where k = 'a'), 'active', 'cus_test_a', 'sub_test_a', now(), now() + interval '1 month', 'INV-0001', now(), 109800);

select throws_ok($$insert into public.tenant_billing (tenant_id, status) values ((select id from biz where k = 'b'), 'paid-ish')$$, '23514', null, 'an unknown status is refused');
select throws_ok($$insert into public.tenant_billing (tenant_id, stripe_customer_id) values ((select id from biz where k = 'b'), 'cus_test_a')$$, '23505', null, 'one Stripe customer cannot belong to two businesses');

-- Business A's admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000042","role":"authenticated"}', true);
select is(public.my_billing() ->> 'status', 'active', 'an admin sees their own business''s subscription');
select is((public.my_billing() ->> 'monthly_pence')::int, 9900, 'with the monthly fee that applies (the default)');
select is((public.my_billing() ->> 'setup_pence')::int, 99900, 'and the set-up fee that applies');
select is(public.my_billing() ->> 'last_invoice_number', 'INV-0001', 'and the last confirmation number');
select is(public.my_billing() ->> 'tenant_id', (select id::text from biz where k = 'a'), 'for their own business only');
select throws_ok($$select * from public.tenant_billing$$, '42501', null, 'staff cannot read the table directly');
select throws_ok($$update public.tenant_billing set status = 'active'$$, '42501', null, 'staff cannot change it');
select throws_ok($$insert into public.tenant_billing (tenant_id, status) values ((select id from biz where k = 'a'), 'active')$$, '42501', null, 'staff cannot add to it');
select throws_ok($$delete from public.tenant_billing$$, '42501', null, 'staff cannot delete from it');

-- A dispatcher of A can see it too.
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000043","role":"authenticated"}', true);
select is(public.my_billing() ->> 'status', 'active', 'a dispatcher sees their own business''s subscription');

-- Business B's admin sees B (nothing paid), never A.
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000044","role":"authenticated"}', true);
select is(public.my_billing() ->> 'status', 'none', 'a business that has paid nothing shows as none');
select is(public.my_billing() ->> 'tenant_id', (select id::text from biz where k = 'b'), 'another business''s admin gets their own business');
select is(public.my_billing() ->> 'last_invoice_number', null, 'and never another business''s confirmation number');

-- A driver, the platform owner and a visitor get nothing.
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000045","role":"authenticated"}', true);
select is(public.my_billing(), null, 'a driver gets nothing');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000041","role":"authenticated"}', true);
select is(public.my_billing(), null, 'the platform owner has no business of their own');
reset role;
set local role anon;
select throws_ok($$select public.my_billing()$$, '42501', null, 'a visitor cannot call it');
reset role;

-- A business's own rate is what its staff see.
update public.tenants set monthly_fee_pence = 4900 where id = (select id from biz where k = 'b');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000044","role":"authenticated"}', true);
select is((public.my_billing() ->> 'monthly_pence')::int, 4900, 'a business with its own monthly rate sees that rate');
reset role;

-- Removing a business removes its billing row.
delete from public.tenants where id = (select id from biz where k = 'a');
select is((select count(*)::int from public.tenant_billing where stripe_customer_id = 'cus_test_a'), 0, 'deleting a business deletes its billing record');

select * from finish();
rollback;
