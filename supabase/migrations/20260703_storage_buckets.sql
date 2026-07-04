insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signature-photos',
  'signature-photos',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'signature-photos owner select'
  ) then
    create policy "signature-photos owner select"
    on storage.objects for select
    using (
      bucket_id = 'signature-photos'
      and (storage.foldername(name))[1] = (auth.uid())::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'signature-photos owner update'
  ) then
    create policy "signature-photos owner update"
    on storage.objects for update
    using (
      bucket_id = 'signature-photos'
      and (storage.foldername(name))[1] = (auth.uid())::text
    )
    with check (
      bucket_id = 'signature-photos'
      and (storage.foldername(name))[1] = (auth.uid())::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'signature-photos owner delete'
  ) then
    create policy "signature-photos owner delete"
    on storage.objects for delete
    using (
      bucket_id = 'signature-photos'
      and (storage.foldername(name))[1] = (auth.uid())::text
    );
  end if;
end $$;
