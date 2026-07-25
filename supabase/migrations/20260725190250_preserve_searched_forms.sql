alter table public.vocab_items
add column if not exists grammatical_role text not null default 'unknown',
add column if not exists usage_note text not null default '',
add column if not exists common_collocations text[] not null default '{}'::text[],
add column if not exists word_family_key text,
add column if not exists sense_key text not null default 'primary';

update public.vocab_items
set
  accepted_answers = case
    when canonical_term = any(accepted_answers) then accepted_answers
    else array_prepend(canonical_term, accepted_answers)
  end,
  word_family_key = trim(both '-' from
    regexp_replace(
      lower(coalesce(nullif(btrim(answer_lemma), ''), canonical_term)),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

alter table public.vocab_items
alter column word_family_key set not null,
alter column word_family_key set default 'unclassified';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocab_items_word_family_key_not_blank'
      and conrelid = 'public.vocab_items'::regclass
  ) then
    alter table public.vocab_items
    add constraint vocab_items_word_family_key_not_blank
    check (length(btrim(word_family_key)) > 0);
  end if;
end;
$$;

create index if not exists vocab_items_user_word_family_idx
  on public.vocab_items (user_id, word_family_key);

update public.cards
set back_text = public.vocab_items.canonical_term
from public.vocab_items
where public.cards.vocab_item_id = public.vocab_items.id
  and public.cards.card_type = 'production';

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
