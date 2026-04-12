-- Plated - Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  partner_id uuid references auth.users(id),
  ai_enabled boolean default false,
  streak integer default 0,
  created_at timestamptz default now()
);

-- Recipes
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  source_url text,
  thumbnail_url text,
  ingredients jsonb default '[]'::jsonb,
  steps jsonb default '[]'::jsonb,
  tags text[] default '{}',
  prep_time integer,
  cook_time integer,
  servings integer default 4,
  rating integer check (rating >= 1 and rating <= 5),
  made_count integer default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Made It Log
create table public.made_it_log (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade,
  user_id uuid references auth.users(id),
  rating integer check (rating >= 1 and rating <= 5),
  notes text,
  photo_url text,
  cooked_at timestamptz default now()
);

-- Grocery List
create table public.grocery_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  amount text,
  category text,
  checked boolean default false,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz default now()
);

-- Pantry Items
create table public.pantry_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  quantity text,
  unit text,
  category text,
  running_low boolean default false,
  created_at timestamptz default now()
);

-- Meal Plans
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  week_start date not null,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  meal_type text not null default 'dinner',
  recipe_id uuid references public.recipes(id) on delete cascade,
  created_at timestamptz default now()
);

-- Function to increment made_count
create or replace function public.increment_made_count(recipe_id uuid)
returns void as $$
  update public.recipes
  set made_count = made_count + 1,
      updated_at = now()
  where id = recipe_id;
$$ language sql security definer;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.made_it_log enable row level security;
alter table public.grocery_items enable row level security;
alter table public.pantry_items enable row level security;
alter table public.meal_plans enable row level security;

-- Policies: authenticated users can read/write all records
-- (shared between both users in the couple)
create policy "Authenticated users can do everything" on public.recipes
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.made_it_log
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.grocery_items
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.pantry_items
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything" on public.meal_plans
  for all to authenticated using (true) with check (true);

create policy "Users can manage own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
