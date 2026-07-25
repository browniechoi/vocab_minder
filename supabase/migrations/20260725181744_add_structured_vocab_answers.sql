alter table public.vocab_items
add column if not exists answer_lemma text,
add column if not exists cloze_answer text,
add column if not exists accepted_answers text[] not null default '{}'::text[],
add column if not exists content_provider text not null default 'merriam_webster',
add column if not exists content_model text,
add column if not exists content_prompt_version text,
add column if not exists content_generated_at timestamptz,
add column if not exists content_edited_at timestamptz,
add column if not exists content_generation_attempt_version text,
add column if not exists content_generation_attempted_at timestamptz,
add column if not exists content_generation_error text;

update public.vocab_items
set
  answer_lemma = coalesce(
    nullif(btrim(answer_lemma), ''),
    regexp_replace(canonical_term, ':[0-9]+$', '')
  ),
  cloze_answer = coalesce(
    nullif(btrim(cloze_answer), ''),
    regexp_replace(canonical_term, ':[0-9]+$', '')
  ),
  accepted_answers = case
    when cardinality(accepted_answers) = 0 then
      array[regexp_replace(canonical_term, ':[0-9]+$', '')]
    else accepted_answers
  end;

alter table public.vocab_items
alter column answer_lemma set not null,
alter column cloze_answer set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocab_items_answer_lemma_not_blank'
      and conrelid = 'public.vocab_items'::regclass
  ) then
    alter table public.vocab_items
    add constraint vocab_items_answer_lemma_not_blank
    check (length(btrim(answer_lemma)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocab_items_cloze_answer_not_blank'
      and conrelid = 'public.vocab_items'::regclass
  ) then
    alter table public.vocab_items
    add constraint vocab_items_cloze_answer_not_blank
    check (length(btrim(cloze_answer)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocab_items_accepted_answers_not_empty'
      and conrelid = 'public.vocab_items'::regclass
  ) then
    alter table public.vocab_items
    add constraint vocab_items_accepted_answers_not_empty
    check (cardinality(accepted_answers) > 0);
  end if;
end;
$$;

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
    back_text = new.answer_lemma,
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
    source_vocab.answer_lemma,
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

drop trigger if exists vocab_items_ensure_card_and_review_state
  on public.vocab_items;

create trigger vocab_items_ensure_card_and_review_state
after insert or update of
  user_id,
  canonical_term,
  answer_lemma,
  definition,
  status,
  created_at
on public.vocab_items
for each row
execute function public.ensure_card_and_review_state_for_vocab_item();
