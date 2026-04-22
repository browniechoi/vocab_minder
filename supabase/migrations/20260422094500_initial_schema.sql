create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro')),
  active_vocab_limit integer not null default 500,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_query text not null,
  canonical_term text not null,
  normalized_term text not null,
  definition text not null,
  example_sentence text,
  part_of_speech text,
  pronunciations jsonb not null default '[]'::jsonb,
  notes text,
  dictionary_source text not null default 'merriam_webster',
  status text not null default 'active' check (status in ('active', 'archived')),
  search_count integer not null default 1,
  last_searched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(pronunciations) = 'array')
);

create unique index vocab_items_user_term_status_idx
  on public.vocab_items (user_id, normalized_term, status);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocab_item_id uuid not null references public.vocab_items(id) on delete cascade,
  card_type text not null default 'basic',
  front_text text not null,
  back_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.review_states (
  card_id uuid primary key references public.cards(id) on delete cascade,
  due_at timestamptz not null,
  interval_days numeric(10,2) not null default 0,
  ease_factor numeric(10,2) not null default 2.5,
  repetition_count integer not null default 0,
  lapse_count integer not null default 0,
  last_reviewed_at timestamptz
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default timezone('utc', now()),
  previous_due_at timestamptz not null,
  new_due_at timestamptz not null
);

create table public.dictionary_cache (
  normalized_query text not null,
  provider text not null,
  response_payload jsonb not null,
  cached_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  primary key (normalized_query, provider)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger vocab_items_set_updated_at
before update on public.vocab_items
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.vocab_items enable row level security;
alter table public.cards enable row level security;
alter table public.review_states enable row level security;
alter table public.review_events enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "vocab_items_rw_own"
  on public.vocab_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cards_rw_own"
  on public.cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "review_events_rw_own"
  on public.review_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "review_states_rw_own"
  on public.review_states
  for all
  using (
    exists (
      select 1
      from public.cards
      where public.cards.id = review_states.card_id
        and public.cards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.cards
      where public.cards.id = review_states.card_id
        and public.cards.user_id = auth.uid()
    )
  );
