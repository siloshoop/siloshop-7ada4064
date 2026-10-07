create or replace function public.search_public_stores(_term text default null, _limit int default 50)
returns table(user_id uuid, store_name text, logo_url text, city text)
language sql stable security definer set search_path = public as $$
  with t as (select translate(lower(btrim(coalesce(_term,''))), 'أإآٱةىؤئ%_', 'ااااهيوي') as q)
  select sa.user_id, sa.store_name, sa.logo_url, sa.city
  from public.seller_applications sa, t
  where sa.status = 'approved'
    and coalesce(sa.store_name,'') <> ''
    and (
      t.q = '' or
      translate(lower(sa.store_name), 'أإآٱةىؤئ', 'ااااهيوي') like '%' || t.q || '%'
      or translate(lower(coalesce(sa.city,'')), 'أإآٱةىؤئ', 'ااااهيوي') like '%' || t.q || '%'
    )
  order by sa.store_name
  limit least(greatest(coalesce(_limit,50),1),200);
$$;
revoke all on function public.search_public_stores(text,int) from public;
grant execute on function public.search_public_stores(text,int) to anon, authenticated;