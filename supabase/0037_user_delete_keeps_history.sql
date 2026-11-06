-- Migration 0037 — deleting a user keeps their history. Run AFTER 0010, 0014 (and 0003).
--
-- Deleting a user (Admin → จัดการผู้ใช้) removes auth.users, which cascades to profiles. These
-- columns referenced profiles with no ON DELETE rule, so anyone who had ever saved a reading,
-- uploaded a file or left an audit row could not be deleted ("violates foreign key constraint
-- audit_log_user_id_fkey"). Now the rows stay and only the link to the person is cleared.

alter table public.audit_log drop constraint if exists audit_log_user_id_fkey;
alter table public.audit_log
  add constraint audit_log_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.reading_attachments drop constraint if exists reading_attachments_uploaded_by_fkey;
alter table public.reading_attachments
  add constraint reading_attachments_uploaded_by_fkey foreign key (uploaded_by) references public.profiles(id) on delete set null;

alter table public.standard_attachments drop constraint if exists standard_attachments_uploaded_by_fkey;
alter table public.standard_attachments
  add constraint standard_attachments_uploaded_by_fkey foreign key (uploaded_by) references public.profiles(id) on delete set null;

alter table public.reports drop constraint if exists reports_created_by_fkey;
alter table public.reports
  add constraint reports_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
