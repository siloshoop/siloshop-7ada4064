create or replace function public.search_public_stores(_term text default null, _limit int default 50)
returns table(user_id uuid, store_name text, logo_url text, city text)
language sql stable security definer set search_path = public as $$
  select sa.user_id, sa.store_name, sa.logo_url, sa.city
  from public.seller_applications sa
  where sa.status = 'approved'
    and coalesce(sa.store_name,'') <> ''
    and (
      _term is null or btrim(_term) = '' or
      translate(lower(sa.store_name), 'أإآٱةىؤئ', 'اااايهيوي') like
        '%' || translate(lower(btrim(_term)), 'أإآٱةىؤئ%_', 'اااايهيوي') || '%'
      or translate(lower(coalesce(sa.city,'')), 'أإآٱةىؤئ', 'اااايهيوي') like
        '%' || translate(lower(btrim(_term)), 'أإآٱةىؤئ%_', 'اااايهيوي') || '%'
    )
  order by sa.store_name
  limit least(greatest(coalesce(_limit,50),1),200);
$$;
revoke all on function public.search_public_stores(text,int) from public;
grant execute on function public.search_public_stores(text,int) to anon, authenticated;