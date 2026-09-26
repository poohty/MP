-- Replace the wide-open "USING (true)" public policies with owner-scoped, authenticated-only ones.
-- Matches the app's actual queries: own CRUD on recipes/profile, friend requests between two users,
-- friends can read a cookbook only when the owner shares it. Anonymous users get no access.

-- ---------- user_profiles ----------
drop policy if exists "Allow public read access to user_profiles" on public.user_profiles;
drop policy if exists "Allow public insert access to user_profiles" on public.user_profiles;
drop policy if exists "Allow public update access to user_profiles" on public.user_profiles;
drop policy if exists "Allow public delete access to user_profiles" on public.user_profiles;

-- Any signed-in user can read profiles (friend search by username).
create policy "profiles readable by signed-in users" on public.user_profiles
  for select to authenticated using (true);
create policy "profiles insert own" on public.user_profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.user_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles delete own" on public.user_profiles
  for delete to authenticated using (id = auth.uid());

-- ---------- recipes ----------
drop policy if exists "Anyone can read recipes" on public.recipes;
drop policy if exists "Users can insert their own recipes" on public.recipes;
drop policy if exists "Users can update their own recipes" on public.recipes;
drop policy if exists "Users can delete their own recipes" on public.recipes;

create policy "recipes read own or shared by friend" on public.recipes
  for select to authenticated using (
    owner_user_id = auth.uid()
    or (
      exists (select 1 from public.user_profiles p
              where p.id = recipes.owner_user_id and p.share_cookbook_with_friends)
      and exists (select 1 from public.friend_links f
                  where f.status = 'accepted'
                    and ((f.user_id = auth.uid() and f.friend_user_id = recipes.owner_user_id)
                      or (f.friend_user_id = auth.uid() and f.user_id = recipes.owner_user_id)))
    )
  );
create policy "recipes insert own" on public.recipes
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy "recipes update own" on public.recipes
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "recipes delete own" on public.recipes
  for delete to authenticated using (owner_user_id = auth.uid());

-- ---------- friend_links ----------
drop policy if exists "Allow public read access to friend_links" on public.friend_links;
drop policy if exists "Allow public insert access to friend_links" on public.friend_links;
drop policy if exists "Allow public update access to friend_links" on public.friend_links;
drop policy if exists "Allow public delete access to friend_links" on public.friend_links;

create policy "links readable by either party" on public.friend_links
  for select to authenticated using (user_id = auth.uid() or friend_user_id = auth.uid());
create policy "links created by requester" on public.friend_links
  for insert to authenticated with check (user_id = auth.uid());
create policy "links accepted by recipient" on public.friend_links
  for update to authenticated using (friend_user_id = auth.uid()) with check (friend_user_id = auth.uid());
create policy "links deleted by either party" on public.friend_links
  for delete to authenticated using (user_id = auth.uid() or friend_user_id = auth.uid());
