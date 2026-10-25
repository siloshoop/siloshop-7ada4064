CREATE OR REPLACE FUNCTION public.seller_update_store_settings(_profile jsonb,_all_provinces boolean,_provinces text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.seller_update_shipping_regions(_all_provinces,_provinces);
 PERFORM public.seller_update_store_profile(_profile->>'_store_name',_profile->>'_store_description',_profile->>'_contact_email',_profile->>'_contact_phone',_profile->>'_address',_profile->>'_city',_profile->>'_logo_url',_profile->>'_cover_image_url',_profile->>'_working_hours',_profile->>'_return_policy',_profile->>'_shipping_policy',_profile->>'_business_info');
END $$;
REVOKE ALL ON FUNCTION public.seller_update_store_settings(jsonb,boolean,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_update_store_settings(jsonb,boolean,text[]) TO authenticated;