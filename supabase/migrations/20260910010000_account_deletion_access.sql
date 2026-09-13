-- Supabase default function privileges can grant anon explicitly; revoking
-- PUBLIC alone does not remove that grant. Only authenticated users may delete
-- their own account through this security-definer transaction.
revoke execute on function public.delete_user_account() from anon;
