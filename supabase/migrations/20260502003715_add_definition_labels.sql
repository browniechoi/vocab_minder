alter table public.vocab_items
add column if not exists definition_labels jsonb not null default '[]'::jsonb,
add constraint vocab_items_definition_labels_is_array
  check (jsonb_typeof(definition_labels) = 'array');
