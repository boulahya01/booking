begin;

-- Profiles must store Student IDs in one canonical representation. Client-side
-- normalization is UX only; this constraint keeps the database authoritative.
alter table public.profiles
  drop constraint if exists profiles_student_id_canonical_format;

alter table public.profiles
  add constraint profiles_student_id_canonical_format
  check (
    student_id is null
    or (
      student_id = upper(btrim(student_id))
      and student_id ~ '^[A-Z][0-9]{9}$'
    )
  );

-- Keep the final verified identity invariant case/whitespace insensitive even if
-- a future privileged code path forgets to canonicalize before writing.
drop index if exists public.profiles_verified_student_id_unique_idx;
create unique index profiles_verified_student_id_unique_idx
  on public.profiles (upper(btrim(student_id)))
  where identity_status = 'verified' and student_id is not null;

commit;
