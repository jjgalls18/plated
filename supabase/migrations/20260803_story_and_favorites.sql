-- Plated — "Our Story" (About Us) + "Our Cookbook" (favorites)

create table public.couple_story (
  id         uuid primary key default gen_random_uuid(),
  photo_url  text,
  story      text,
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.couple_story to authenticated;

alter table public.couple_story enable row level security;

create policy "Linked partners full access" on public.couple_story
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

alter table public.recipes add column if not exists is_favorite boolean not null default false;
