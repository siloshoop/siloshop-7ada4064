INSERT INTO public.user_roles (user_id, role) VALUES
  ('b5aa4b27-a05a-456d-82c9-a2f1bbae5edf','moderator'),
  ('7b7f985b-6bde-4f8f-ba3a-dc669af9237c','admin'),
  ('cf967bbf-2c8e-440c-8ff9-b0381869c676','super_admin')
ON CONFLICT (user_id, role) DO NOTHING;