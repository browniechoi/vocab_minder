create unique index if not exists cards_vocab_item_id_idx
  on public.cards (vocab_item_id);

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
    front_text,
    back_text,
    is_active
  )
  values (
    new.user_id,
    new.id,
    new.canonical_term,
    new.definition,
    new.status = 'active'
  )
  on conflict (vocab_item_id) do update
  set
    user_id = excluded.user_id,
    front_text = excluded.front_text,
    back_text = excluded.back_text,
    is_active = excluded.is_active
  returning id into ensured_card_id;

  insert into public.review_states (
    card_id,
    due_at,
    interval_days,
    ease_factor,
    repetition_count,
    lapse_count,
    last_reviewed_at
  )
  values (
    ensured_card_id,
    new.created_at,
    0,
    2.5,
    0,
    0,
    null
  )
  on conflict (card_id) do nothing;

  return new;
end;
$$;

drop trigger if exists vocab_items_ensure_card_and_review_state
  on public.vocab_items;

create trigger vocab_items_ensure_card_and_review_state
after insert or update of user_id, canonical_term, definition, status, created_at
on public.vocab_items
for each row
execute function public.ensure_card_and_review_state_for_vocab_item();

insert into public.cards (
  user_id,
  vocab_item_id,
  front_text,
  back_text,
  is_active
)
select
  vocab_items.user_id,
  vocab_items.id,
  vocab_items.canonical_term,
  vocab_items.definition,
  vocab_items.status = 'active'
from public.vocab_items
on conflict (vocab_item_id) do update
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
  last_reviewed_at
)
select
  cards.id,
  vocab_items.created_at,
  0,
  2.5,
  0,
  0,
  null
from public.cards
join public.vocab_items
  on public.vocab_items.id = public.cards.vocab_item_id
left join public.review_states
  on public.review_states.card_id = public.cards.id
where public.review_states.card_id is null;
