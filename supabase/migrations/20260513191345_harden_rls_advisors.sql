alter table public.dictionary_cache enable row level security;

alter function public.set_updated_at()
set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated;

alter policy "profiles_select_own"
  on public.profiles
  using ((select auth.uid()) = user_id);

alter policy "profiles_insert_own"
  on public.profiles
  with check ((select auth.uid()) = user_id);

alter policy "profiles_update_own"
  on public.profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "vocab_items_rw_own"
  on public.vocab_items
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "cards_rw_own"
  on public.cards
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "review_events_rw_own"
  on public.review_events
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "review_states_rw_own"
  on public.review_states
  using (
    exists (
      select 1
      from public.cards
      where public.cards.id = review_states.card_id
        and public.cards.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.cards
      where public.cards.id = review_states.card_id
        and public.cards.user_id = (select auth.uid())
    )
  );
