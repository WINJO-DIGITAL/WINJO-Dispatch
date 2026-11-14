-- Self-serve sign-up .
-- Rolls back; creates its own fixtures.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-000000000051', 'owner@signup.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000052', 'admin@signup.invalid');
insert into public.tenants (id, slug, name) values ('a0000000-0000-4000-8000-000000000001', 'sample-cars', 'Sample Cars');
insert into public.tenant_users (tenant_id, user_id, role) values
  (null, 'eeeeeeee-0000-4000-8000-000000000051', 'super_admin'),
  ('a0000000-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000052', 'operator_admin');

-- The website's server (service role) files applications.
set local role service_role;
insert into public.signup_applications (business_name, slug, contact_name, contact_email, contact_phone, contract_version, responsibilities_version, setup_pence, monthly_pence)
values ('Moor Cars Ltd', 'moor-cars', 'Sam Moor', 'sam@moor.invalid', '07700900001', '1', '1', 99900, 9900),
       ('Dale Travel', 'dale-travel', 'Pat Dale', 'pat@dale.invalid', null, '1', '1', 99900, 9900),
       ('Free Trial Cars', 'free-trial', 'Lee Free', 'lee@free.invalid', null, '1', '1', 0, 0),
       ('Nope Ltd', 'nope-ltd', 'Nia Nope', 'nia@nope.invalid', null, '1', '1', 99900, 9900);
reset role;

create temp table apps as select slug, id from public.signup_applications;
grant select on apps to public;

select is((select count(*)::int from public.signup_applications), 4, 'the server can file applications');
select is((select status from public.signup_applications where slug = 'moor-cars'), 'awaiting_payment', 'a new application waits for payment');

select throws_ok($$insert into public.signup_applications (business_name, slug, contact_name, contact_email, contract_version, responsibilities_version, setup_pence, monthly_pence) values ('Other', 'moor-cars', 'X', 'x@x.invalid', '1', '1', 1, 1)$$, '23505', null, 'two open applications cannot want the same short name');
select throws_ok($$insert into public.signup_applications (business_name, slug, contact_name, contact_email, contract_version, responsibilities_version, setup_pence, monthly_pence) values ('Bad', 'Bad Slug', 'X', 'x@x.invalid', '1', '1', 1, 1)$$, '23514', null, 'a short name must be lowercase letters, numbers and hyphens');
select throws_ok($$insert into public.signup_applications (business_name, slug, contact_name, contact_email, contract_version, responsibilities_version, setup_pence, monthly_pence) values ('Bad', 'bad-mail', 'X', 'not-an-email', '1', '1', 1, 1)$$, '23514', null, 'an invalid email is refused');

-- Visitors cannot read, write or call anything.
set local role anon;
select throws_ok($$select count(*) from public.signup_applications$$, '42501', null, 'a visitor cannot read applications');
select throws_ok($$insert into public.signup_applications (business_name, slug, contact_name, contact_email, contract_version, responsibilities_version, setup_pence, monthly_pence) values ('V', 'visitor-co', 'X', 'x@x.invalid', '1', '1', 1, 1)$$, '42501', null, 'a visitor cannot file one directly');
select throws_ok($$select public.list_signup_applications()$$, '42501', null, 'a visitor cannot list them');
reset role;

-- A business admin is not the platform owner.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000052","role":"authenticated"}', true);
select throws_ok($$select count(*) from public.signup_applications$$, '42501', null, 'a business admin cannot read applications directly');
select throws_ok($$select public.list_signup_applications()$$, '42501', null, 'a business admin cannot list applications');
select throws_ok($$select public.mark_signup_paid((select id from apps where slug = 'moor-cars'))$$, '42501', null, 'a business admin cannot confirm payment');
select throws_ok($$select public.approve_signup_application((select id from apps where slug = 'moor-cars'))$$, '42501', null, 'a business admin cannot approve');
select throws_ok($$select public.reject_signup_application((select id from apps where slug = 'moor-cars'))$$, '42501', null, 'a business admin cannot reject');

-- The platform owner.
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000051","role":"authenticated"}', true);
select is((select count(*)::int from public.list_signup_applications()), 4, 'the owner can list applications');
select throws_ok($$select public.approve_signup_application((select id from apps where slug = 'moor-cars'))$$, '22023', null, 'an application with a fee cannot be approved before payment is confirmed');
select lives_ok($$select public.mark_signup_paid((select id from apps where slug = 'moor-cars'), 'Bank transfer received')$$, 'the owner can confirm payment');
select throws_ok($$select public.mark_signup_paid((select id from apps where slug = 'moor-cars'))$$, 'P0002', null, 'payment cannot be confirmed twice');
select lives_ok($$select public.approve_signup_application((select id from apps where slug = 'moor-cars'))$$, 'the owner can approve a paid application');
reset role;

select is((select status from public.signup_applications where slug = 'moor-cars'), 'approved', 'it is marked approved');
select is((select name from public.tenants where slug = 'moor-cars'), 'Moor Cars Ltd', 'the business now exists under its short name');
select is((select contact_email from public.tenants where slug = 'moor-cars'), 'sam@moor.invalid', 'with the contact details from the application');
select is((select count(*)::int from public.notification_channel_settings where tenant_id = (select id from public.tenants where slug = 'moor-cars')), 1, 'and its notification settings');
select is((select tenant_id from public.signup_applications where slug = 'moor-cars'), (select id from public.tenants where slug = 'moor-cars'), 'the application points at its business');
select is((select decided_by from public.signup_applications where slug = 'moor-cars'), 'eeeeeeee-0000-4000-8000-000000000051'::uuid, 'and records who approved it');
select is((select count(*)::int from public.tenant_users tu join public.tenants t on t.id = tu.tenant_id where t.slug = 'moor-cars'), 0, 'approving creates no login for the applicant');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000051","role":"authenticated"}', true);
select throws_ok($$select public.approve_signup_application((select id from apps where slug = 'moor-cars'))$$, '22023', null, 'an approved application cannot be approved again');
select throws_ok($$select public.reject_signup_application((select id from apps where slug = 'moor-cars'))$$, 'P0002', null, 'an approved application cannot be rejected');
select lives_ok($$select public.approve_signup_application((select id from apps where slug = 'free-trial'))$$, 'a £0 set-up can be approved without a payment step');
select lives_ok($$select public.reject_signup_application((select id from apps where slug = 'nope-ltd'), 'Not a transport business')$$, 'the owner can reject an application');
select throws_ok($$select public.approve_signup_application((select id from apps where slug = 'nope-ltd'))$$, '22023', null, 'a rejected application cannot be approved');
select throws_ok($$select public.approve_signup_application('00000000-0000-4000-8000-00000000dead')$$, 'P0002', null, 'an unknown application is refused');
reset role;

select is((select decision_note from public.signup_applications where slug = 'nope-ltd'), 'Not a transport business', 'the reason is recorded');
-- A short name already used by a business cannot be approved.
set local role service_role;
insert into public.signup_applications (business_name, slug, contact_name, contact_email, contract_version, responsibilities_version, setup_pence, monthly_pence, status)
values ('Clash Ltd', 'sample-cars', 'C', 'c@clash.invalid', '1', '1', 0, 0, 'awaiting_payment');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000051","role":"authenticated"}', true);
select throws_ok($$select public.approve_signup_application((select id from public.list_signup_applications() where slug = 'sample-cars'))$$, '23505', null, 'a short name already used by a business is refused');
reset role;

select * from finish();
rollback;
