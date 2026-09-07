-- Browser renders upload directly through a short-lived signed URL. Keep the
-- private bucket constrained even though the signed path is already scoped.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'distribution-media';
