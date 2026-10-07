ALTER TABLE public.delivery_addresses ALTER COLUMN street DROP NOT NULL;
COMMENT ON COLUMN public.delivery_addresses.street IS 'DEPRECATED: street field removed from the app';