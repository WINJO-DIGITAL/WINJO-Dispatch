-- A new customer's profile is filed under the business named at sign-up.
-- Rolls back; creates its own fixtures.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

create temp table biz as select id from public.provision_tenant('signup-test', 'Signup Test');
insert into public.tenants (id, slug, name, status) values ('cccccccc-0000-4000-8000-000000000009', 'signup-paused', 'Paused Co', 'suspended');

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-4000-8000-0000000000a1', 'a1@signup.invalid', (select jsonb_build_object('full_name', 'Ann', 'tenant_id', id) from biz)),
  ('cccccccc-0000-4000-8000-0000000000a2', 'a2@signup.invalid', '{"full_name":"Bob"}'),
  ('cccccccc-0000-4000-8000-0000000000a3', 'a3@signup.invalid', '{"full_name":"Cat","tenant_id":"not-a-uuid"}'),
  ('cccccccc-0000-4000-8000-0000000000a4', 'a4@signup.invalid', '{"full_name":"Dan","tenant_id":"cccccccc-0000-4000-8000-0000000000ff"}'),
  ('cccccccc-0000-4000-8000-0000000000a5', 'a5@signup.invalid', '{"full_name":"Eve","tenant_id":"cccccccc-0000-4000-8000-000000000009"}');

select is((select tenant_id from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a1'), (select id from biz), 'a customer who signed up on another business''s site is filed under it');
select is((select full_name from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a1'), 'Ann', 'their name is still saved');
select is((select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a2'), 0, 'no business given: no customer profile (staff, drivers and the platform owner have none)');
select is((select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a3'), 0, 'a malformed value does not block sign-up and gives no profile');
select is((select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a4'), 0, 'an unknown business gives no profile');
select is((select count(*)::int from public.profiles where id = 'cccccccc-0000-4000-8000-0000000000a5'), 0, 'a suspended business is not used');
select is((select count(*)::int from auth.users where id::text like 'cccccccc-0000-4000-8000-0000000000a%'), 5, 'every sign-up still created its account');

select * from finish();
rollback;
