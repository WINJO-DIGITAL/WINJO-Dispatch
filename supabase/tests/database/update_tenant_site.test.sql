-- Site builder content and publish switch (draft migration supabase/pending/20261113190000_tenant_site_content.sql).
-- Rolls back; creates its own fixtures.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create temp table biz as select id from public.provision_tenant('site-test', 'Site Test Co');
create temp table other as select id from public.provision_tenant('site-other', 'Site Other Co');
grant select on biz to public;
grant select on other to public;
insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-000000000041', 'admin@site.invalid'),
  ('eeeeeeee-0000-4000-8000-000000000042', 'driver@site.invalid');
insert into public.tenant_users (tenant_id, user_id, role) values
  ((select id from biz), 'eeeeeeee-0000-4000-8000-000000000041', 'operator_admin'),
  ((select id from biz), 'eeeeeeee-0000-4000-8000-000000000042', 'driver');

-- A business's own admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000041","role":"authenticated"}', true);

select lives_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"Hello"},"areas":["Leeds"]}'::jsonb, false)$$, 'an admin can save a draft');
select is((select brand ->> 'site_published' from public.tenants where slug = 'site-test'), 'false', 'a draft is not published');
select is((select brand #>> '{site,hero,headline}' from public.tenants where slug = 'site-test'), 'Hello', 'the content is saved');
select lives_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"Hello"}}'::jsonb, true)$$, 'an admin can publish');
select is((select brand ->> 'site_published' from public.tenants where slug = 'site-test'), 'true', 'it is published');
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":" "}}'::jsonb, true)$$, '22023', null, 'publishing needs a headline');
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":"x"}'::jsonb, false)$$, '22023', null, 'a section of the wrong type is refused');
select throws_ok($$select public.update_tenant_site((select id from biz), jsonb_build_object('areas', (select jsonb_agg(i) from generate_series(1, 31) i)), false)$$, '22023', null, 'a list over its cap is refused');
select throws_ok($$select public.update_tenant_site((select id from biz), '[]'::jsonb, false)$$, '22023', null, 'content that is not an object is refused');

select lives_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"H"},"design":{"direction":"editorial"}}'::jsonb, false)$$, 'a known design direction is accepted');
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"H"},"design":{"direction":"neon"}}'::jsonb, false)$$, '22023', null, 'an unknown design direction is refused');

select lives_ok(format($f$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"H","image_url":"https://abc.supabase.co/storage/v1/object/public/brand-assets/%s/hero.jpg"}}'::jsonb, false)$f$, (select id from biz)), 'a photo in the business''s own folder is accepted');
select throws_ok(format($f$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"H","image_url":"https://abc.supabase.co/storage/v1/object/public/brand-assets/%s/hero.jpg"}}'::jsonb, false)$f$, (select id from other)), '22023', null, 'a photo in another business''s folder is refused');
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"H","image_url":"https://evil.example/x.jpg"}}'::jsonb, false)$$, '22023', null, 'a photo from elsewhere is refused');
select throws_ok($$select public.update_tenant_site((select id from biz), '{"services":[{"title":"S","image_url":"https://evil.example/x.jpg"}]}'::jsonb, false)$$, '22023', null, 'a photo nested in a list is checked too');
select is((select brand ->> 'site_url' from public.tenants where slug = 'site-test'), null, 'saving the site leaves other brand settings alone');

-- Another business's content is out of reach.
select throws_ok($$select public.update_tenant_site((select id from other), '{"hero":{"headline":"Mine now"}}'::jsonb, true)$$, '42501', null, 'an admin cannot change another business''s website');

-- A driver cannot change the website.
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-8000-000000000042","role":"authenticated"}', true);
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"X"}}'::jsonb, true)$$, '42501', null, 'a driver cannot change the website');

-- Visitors cannot.
reset role;
set local role anon;
select throws_ok($$select public.update_tenant_site((select id from biz), '{"hero":{"headline":"X"}}'::jsonb, true)$$, '42501', null, 'a visitor cannot change the website');

select * from finish();
rollback;
