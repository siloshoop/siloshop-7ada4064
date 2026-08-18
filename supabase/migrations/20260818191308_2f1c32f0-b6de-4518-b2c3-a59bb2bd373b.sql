DELETE FROM public.user_roles WHERE (user_id, role) IN (
  ('b5aa4b27-a05a-456d-82c9-a2f1bbae5edf','moderator'),
  ('7b7f985b-6bde-4f8f-ba3a-dc669af9237c','admin'),
  ('cf967bbf-2c8e-440c-8ff9-b0381869c676','super_admin')
);
DELETE FROM public.announcements WHERE text = 'audit-test';
DELETE FROM public.admin_audit_log WHERE reason IS NULL AND target_type IN ('announcements','user_roles') AND created_at > now() - interval '2 hours';
DELETE FROM public.admin_audit_log WHERE reason IN ('audit','audit revoke');