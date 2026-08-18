DO $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  r := public.bootstrap_first_super_admin('mohamadtaim15@gmail.com');
  RAISE NOTICE 'bootstrap result: %', r;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;