-- Migration 0022 — enforce file size/type limits at the storage-bucket level.
-- Previously none of the 3 attachment buckets had file_size_limit/allowed_mime_types
-- set, so only client-side JS checks (trivially bypassable via a direct API call)
-- limited what could be uploaded. This makes the limits authoritative server-side.

update storage.buckets set
  file_size_limit = 10 * 1024 * 1024, -- 10MB, matches lib/parse/excel-utils.ts's MAX_FILE_MB
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv'
  ]
where id = 'lab-attachments';

update storage.buckets set
  file_size_limit = 20 * 1024 * 1024, -- 20MB — standards/WO attachments also allow docs/images
  allowed_mime_types = array[
    'application/pdf',
    'application/msword', -- .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'image/png',
    'image/jpeg'
  ]
where id in ('standard-attachments', 'wo-attachments');
