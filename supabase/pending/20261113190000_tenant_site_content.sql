-- Site builder: a business's own website content and publish switch (DRAFT, not applied to live).
--
-- tenants.brand gains:
--   site            the content the business entered (see lib/siteContent.js for the shape)
--   site_published  true once the business has chosen to publish it
-- Written only through update_tenant_site(): operator_admin of that tenant or super_admin.
-- The website re-checks and cleans the content again when it draws a page, so these checks are
-- a second layer: size, list lengths, and every photo must be in this business's own
-- brand-assets folder.

create or replace function public.update_tenant_site(
  p_tenant_id uuid,
  p_site jsonb,
  p_published boolean default false
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tenants;
  v_site jsonb := coalesce(p_site, '{}'::jsonb);
  v_key text;
  v_cap int;
  v_url jsonb;
  v_headline text;
begin
  if not exists (
    select 1 from public.tenant_users tu
    where tu.user_id = auth.uid()
      and (tu.role = 'super_admin'
           or (tu.tenant_id = p_tenant_id and tu.role = 'operator_admin'))
  ) then
    raise exception 'Only an operator admin can change the website' using errcode = '42501';
  end if;

  if jsonb_typeof(v_site) is distinct from 'object' then
    raise exception 'The website content must be an object' using errcode = '22023';
  end if;
  if length(v_site::text) > 60000 then
    raise exception 'The website content is too large' using errcode = '22023';
  end if;

  -- List sections: array, within its cap.
  for v_key, v_cap in select * from (values ('services', 8), ('fleet', 12), ('areas', 30), ('reviews', 12), ('faqs', 12)) as c(k, n) loop
    if v_site ? v_key then
      if jsonb_typeof(v_site -> v_key) is distinct from 'array' then
        raise exception '% must be a list', v_key using errcode = '22023';
      end if;
      if jsonb_array_length(v_site -> v_key) > v_cap then
        raise exception 'Too many entries in %', v_key using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Single sections: object.
  for v_key in select unnest(array['hero', 'about', 'contact', 'seo']) loop
    if v_site ? v_key and jsonb_typeof(v_site -> v_key) is distinct from 'object' then
      raise exception '% must be an object', v_key using errcode = '22023';
    end if;
  end loop;

  -- Every photo must be a file in this business's own brand-assets folder.
  for v_url in select jsonb_path_query(v_site, '$.**.image_url') loop
    if jsonb_typeof(v_url) is distinct from 'string'
       or (v_url #>> '{}') !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/brand-assets/'
                               || p_tenant_id::text || '/[A-Za-z0-9._-]{1,120}$') then
      if v_url #>> '{}' <> '' then
        raise exception 'Photos must be uploaded from Settings, Website' using errcode = '22023';
      end if;
    end if;
  end loop;

  v_headline := btrim(coalesce(v_site #>> '{hero,headline}', ''));
  if coalesce(p_published, false) and v_headline = '' then
    raise exception 'Add a headline before publishing' using errcode = '22023';
  end if;

  update public.tenants t
     set brand = (coalesce(t.brand, '{}'::jsonb) - 'site' - 'site_published')
                 || jsonb_build_object('site', v_site, 'site_published', coalesce(p_published, false)),
         updated_at = now()
   where t.id = p_tenant_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Unknown tenant' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.update_tenant_site(uuid, jsonb, boolean) from public, anon;
grant execute on function public.update_tenant_site(uuid, jsonb, boolean) to authenticated;
