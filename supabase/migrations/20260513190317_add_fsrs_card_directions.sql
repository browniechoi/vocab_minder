alter table public.vocab_items
add column if not exists cloze_sentence text;

alter table public.review_states
add column if not exists stability_days numeric(10,2) not null default 0,
add column if not exists difficulty numeric(10,2) not null default 0,
add column if not exists fsrs_state text not null default 'New',
add column if not exists learning_steps integer not null default 0,
add column if not exists desired_retention numeric(4,3) not null default 0.92;

update public.review_states
set
  stability_days = case
    when stability_days = 0 then greatest(interval_days, 0)
    else stability_days
  end,
  difficulty = case
    when difficulty = 0 then ease_factor
    else difficulty
  end,
  fsrs_state = case
    when repetition_count > 0 then 'Review'
    else fsrs_state
  end,
  desired_retention = 0.92;

update public.cards
set card_type = 'recognition'
where card_type = 'basic';

drop index if exists public.cards_vocab_item_id_idx;

create unique index if not exists cards_vocab_item_id_card_type_idx
  on public.cards (vocab_item_id, card_type);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_card_type_check'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
    add constraint cards_card_type_check
    check (card_type in ('recognition', 'production', 'listening'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_states_fsrs_state_check'
      and conrelid = 'public.review_states'::regclass
  ) then
    alter table public.review_states
    add constraint review_states_fsrs_state_check
    check (fsrs_state in ('New', 'Learning', 'Review', 'Relearning'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'review_states_desired_retention_check'
      and conrelid = 'public.review_states'::regclass
  ) then
    alter table public.review_states
    add constraint review_states_desired_retention_check
    check (desired_retention > 0 and desired_retention < 1);
  end if;
end;
$$;

alter table public.cards
alter column card_type set default 'recognition';

create or replace function public.ensure_card_and_review_state_for_vocab_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ensured_card_id uuid;
begin
  insert into public.cards (
    user_id,
    vocab_item_id,
    card_type,
    front_text,
    back_text,
    is_active
  )
  values (
    new.user_id,
    new.id,
    'recognition',
    new.canonical_term,
    new.definition,
    new.status = 'active'
  )
  on conflict (vocab_item_id, card_type) do update
  set
    user_id = excluded.user_id,
    front_text = excluded.front_text,
    back_text = excluded.back_text,
    is_active = excluded.is_active
  returning id into ensured_card_id;

  update public.cards
  set
    user_id = new.user_id,
    front_text = new.definition,
    back_text = new.canonical_term,
    is_active = new.status = 'active'
  where vocab_item_id = new.id
    and card_type = 'production';

  insert into public.review_states (
    card_id,
    due_at,
    interval_days,
    ease_factor,
    repetition_count,
    lapse_count,
    last_reviewed_at,
    stability_days,
    difficulty,
    fsrs_state,
    learning_steps,
    desired_retention
  )
  values (
    ensured_card_id,
    new.created_at,
    0,
    0,
    0,
    0,
    null,
    0,
    0,
    'New',
    0,
    0.92
  )
  on conflict (card_id) do nothing;

  return new;
end;
$$;

insert into public.cards (
  user_id,
  vocab_item_id,
  card_type,
  front_text,
  back_text,
  is_active
)
select
  vocab_items.user_id,
  vocab_items.id,
  'recognition',
  vocab_items.canonical_term,
  vocab_items.definition,
  vocab_items.status = 'active'
from public.vocab_items
on conflict (vocab_item_id, card_type) do update
set
  user_id = excluded.user_id,
  front_text = excluded.front_text,
  back_text = excluded.back_text,
  is_active = excluded.is_active;

insert into public.cards (
  user_id,
  vocab_item_id,
  card_type,
  front_text,
  back_text,
  is_active
)
select
  vocab_items.user_id,
  vocab_items.id,
  'production',
  vocab_items.definition,
  vocab_items.canonical_term,
  vocab_items.status = 'active'
from public.vocab_items
join public.cards recognition_cards
  on recognition_cards.vocab_item_id = vocab_items.id
  and recognition_cards.card_type = 'recognition'
join public.review_states recognition_states
  on recognition_states.card_id = recognition_cards.id
where recognition_states.repetition_count >= 2
  or recognition_states.interval_days >= 1
on conflict (vocab_item_id, card_type) do update
set
  user_id = excluded.user_id,
  front_text = excluded.front_text,
  back_text = excluded.back_text,
  is_active = excluded.is_active;

insert into public.review_states (
  card_id,
  due_at,
  interval_days,
  ease_factor,
  repetition_count,
  lapse_count,
  last_reviewed_at,
  stability_days,
  difficulty,
  fsrs_state,
  learning_steps,
  desired_retention
)
select
  cards.id,
  case
    when cards.card_type = 'production' then timezone('utc', now())
    else vocab_items.created_at
  end,
  0,
  0,
  0,
  0,
  null,
  0,
  0,
  'New',
  0,
  0.92
from public.cards
join public.vocab_items
  on public.vocab_items.id = public.cards.vocab_item_id
left join public.review_states
  on public.review_states.card_id = public.cards.id
where public.review_states.card_id is null;

create or replace function public.ensure_production_card_for_recognition_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_vocab public.vocab_items%rowtype;
  source_card public.cards%rowtype;
  production_card_id uuid;
begin
  select *
  into source_card
  from public.cards
  where id = new.card_id
    and card_type = 'recognition';

  if not found then
    return new;
  end if;

  if new.repetition_count < 2 and new.interval_days < 1 then
    return new;
  end if;

  select *
  into source_vocab
  from public.vocab_items
  where id = source_card.vocab_item_id;

  if not found then
    return new;
  end if;

  insert into public.cards (
    user_id,
    vocab_item_id,
    card_type,
    front_text,
    back_text,
    is_active
  )
  values (
    source_vocab.user_id,
    source_vocab.id,
    'production',
    source_vocab.definition,
    source_vocab.canonical_term,
    source_vocab.status = 'active'
  )
  on conflict (vocab_item_id, card_type) do update
  set
    user_id = excluded.user_id,
    front_text = excluded.front_text,
    back_text = excluded.back_text,
    is_active = excluded.is_active
  returning id into production_card_id;

  insert into public.review_states (
    card_id,
    due_at,
    interval_days,
    ease_factor,
    repetition_count,
    lapse_count,
    last_reviewed_at,
    stability_days,
    difficulty,
    fsrs_state,
    learning_steps,
    desired_retention
  )
  values (
    production_card_id,
    timezone('utc', now()),
    0,
    0,
    0,
    0,
    null,
    0,
    0,
    'New',
    0,
    0.92
  )
  on conflict (card_id) do nothing;

  return new;
end;
$$;

drop trigger if exists review_states_ensure_production_card
  on public.review_states;

create trigger review_states_ensure_production_card
after insert or update of repetition_count, interval_days
on public.review_states
for each row
execute function public.ensure_production_card_for_recognition_review();
