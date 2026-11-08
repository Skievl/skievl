-- =============================================================================
-- Migration 3: Row Level Security, column-level grants, function privileges,
-- and Supabase Storage policies.
--
-- Principle: browser clients get the narrowest table/column privileges they
-- need; RLS limits which rows. Admin *writes* always go through server code
-- that verifies the admin role and uses the service role (with an audit log),
-- so admins only need extra SELECT visibility here.
-- =============================================================================

-- Start from zero for client roles
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Enable RLS everywhere
alter table public.profiles              enable row level security;
alter table public.seller_profiles       enable row level security;
alter table public.seller_private        enable row level security;
alter table public.dropoff_areas         enable row level security;
alter table public.categories            enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.brands                enable row level security;
alter table public.platform_settings     enable row level security;
alter table public.listings              enable row level security;
alter table public.listing_images        enable row level security;
alter table public.favorites             enable row level security;
alter table public.orders                enable row level security;
alter table public.payments              enable row level security;
alter table public.refunds               enable row level security;
alter table public.disputes              enable row level security;
alter table public.payouts               enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.reviews               enable row level security;
alter table public.seller_responses      enable row level security;
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;
alter table public.reports               enable row level security;
alter table public.notifications         enable row level security;
alter table public.admin_audit_log       enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalog
-- ---------------------------------------------------------------------------
grant select on public.categories, public.attribute_definitions, public.brands to anon, authenticated;
create policy "catalog readable" on public.categories            for select using (is_active or public.is_admin());
create policy "attrs readable"   on public.attribute_definitions for select using (true);
create policy "brands readable"  on public.brands                for select using (is_active or public.is_admin());

-- Commission %, limits etc. are not secret
grant select on public.platform_settings to anon, authenticated;
create policy "settings readable" on public.platform_settings for select using (true);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url, home_town) on public.profiles to authenticated;
create policy "profiles public" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.seller_profiles to anon, authenticated;
grant insert (user_id, shop_name, bio, town) on public.seller_profiles to authenticated;
grant update (shop_name, bio, town) on public.seller_profiles to authenticated;
create policy "sellers public" on public.seller_profiles for select using (true);
create policy "become seller" on public.seller_profiles for insert
  with check (user_id = auth.uid() and public.is_active_user());
create policy "seller self update" on public.seller_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private address: owner only. Admins do NOT get blanket access.
grant select, insert, update, delete on public.seller_private to authenticated;
create policy "seller private owner" on public.seller_private for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Drop-off ZIPs are public (buyers need to see where a seller delivers)
grant select on public.dropoff_areas to anon, authenticated;
grant insert (seller_id, postal_code, label), delete on public.dropoff_areas to authenticated;
create policy "dropoff public" on public.dropoff_areas for select using (true);
create policy "dropoff owner insert" on public.dropoff_areas for insert with check (seller_id = auth.uid());
create policy "dropoff owner delete" on public.dropoff_areas for delete using (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
grant select on public.listings to anon, authenticated;
grant insert (id, seller_id, category_id, brand_id, brand_other, title, model, model_year, description,
              condition, condition_notes, price_cents, gender, age_group, attributes,
              offers_pickup, offers_dropoff, dropoff_fee_cents, status)
  on public.listings to authenticated;
grant update (category_id, brand_id, brand_other, title, model, model_year, description,
              condition, condition_notes, price_cents, gender, age_group, attributes,
              offers_pickup, offers_dropoff, dropoff_fee_cents, status)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;

create or replace function public.is_listing_buyer(p_listing_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.orders o where o.listing_id = p_listing_id and o.buyer_id = auth.uid());
$$;
grant execute on function public.is_listing_buyer(uuid) to anon, authenticated;

create policy "listings visible" on public.listings for select using (
  status in ('active', 'reserved', 'sold')
  or seller_id = auth.uid()
  or public.is_admin()
  or public.is_listing_buyer(id)
);
create policy "listings seller insert" on public.listings for insert
  with check (seller_id = auth.uid() and public.is_active_user());
create policy "listings seller update" on public.listings for update
  using (seller_id = auth.uid() and public.is_active_user()) with check (seller_id = auth.uid());
create policy "listings seller delete" on public.listings for delete using (seller_id = auth.uid());

grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, sort_order, width, height), update (sort_order), delete
  on public.listing_images to authenticated;
create policy "images visible" on public.listing_images for select using (
  exists (select 1 from public.listings l where l.id = listing_id)  -- inherits listings RLS
);
create policy "images owner insert" on public.listing_images for insert with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
          and l.status not in ('reserved','sold','removed'))
  and storage_path like auth.uid()::text || '/%'
);
create policy "images owner update" on public.listing_images for update using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);
create policy "images owner delete" on public.listing_images for delete using (
  exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
          and l.status not in ('reserved','sold','removed'))
);

grant select, insert, delete on public.favorites to authenticated;
create policy "favorites own" on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Orders & money: read-only for participants; writes via SECURITY DEFINER
-- functions or the service role.
-- ---------------------------------------------------------------------------
grant select on public.orders to authenticated;
create policy "orders participants" on public.orders for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

grant select on public.payments, public.refunds, public.disputes to authenticated;
create policy "payments participants" on public.payments for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id
                               and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "refunds participants" on public.refunds for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id
                               and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "disputes seller/admin" on public.disputes for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()));

grant select on public.payouts to authenticated;
create policy "payouts seller" on public.payouts for select using (seller_id = auth.uid() or public.is_admin());

-- stripe_events and admin_audit_log: admin read only
grant select on public.stripe_events, public.admin_audit_log to authenticated;
create policy "events admin"  on public.stripe_events   for select using (public.is_admin());
create policy "audit admin"   on public.admin_audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
grant select on public.reviews to anon, authenticated;
grant insert (order_id, buyer_id, seller_id, rating_overall, rating_communication,
              rating_accuracy, rating_transaction, body) on public.reviews to authenticated;
create policy "reviews public" on public.reviews for select
  using (status = 'published' or buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "reviews verified buyer insert" on public.reviews for insert with check (
  buyer_id = auth.uid()
  and public.is_active_user()
  and exists (select 1 from public.orders o
              where o.id = order_id and o.buyer_id = auth.uid()
                and o.seller_id = reviews.seller_id and o.status = 'completed')
);

grant select on public.seller_responses to anon, authenticated;
grant insert (review_id, seller_id, body), update (body) on public.seller_responses to authenticated;
create policy "responses public" on public.seller_responses for select
  using (not is_hidden or seller_id = auth.uid() or public.is_admin());
create policy "responses seller insert" on public.seller_responses for insert with check (
  seller_id = auth.uid()
  and exists (select 1 from public.reviews r where r.id = review_id and r.seller_id = auth.uid())
);
create policy "responses seller update" on public.seller_responses for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
grant select on public.conversations to authenticated;
create policy "conversations participants" on public.conversations for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

grant select, insert (conversation_id, sender_id, body), update (read_at) on public.messages to authenticated;
create policy "messages participants read" on public.messages for select using (
  public.is_admin() or exists (select 1 from public.conversations c where c.id = conversation_id
                               and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "messages participants send" on public.messages for insert with check (
  sender_id = auth.uid() and public.is_active_user()
  and exists (select 1 from public.conversations c where c.id = conversation_id
              and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
create policy "messages recipient mark read" on public.messages for update using (
  sender_id <> auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id
              and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- ---------------------------------------------------------------------------
-- Reports & notifications
-- ---------------------------------------------------------------------------
grant select, insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;
create policy "reports own read" on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy "reports create"   on public.reports for insert with check (reporter_id = auth.uid() and public.is_active_user());

grant select, update (read_at) on public.notifications to authenticated;
create policy "notifications own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
grant execute on function public.is_admin()        to anon, authenticated;
grant execute on function public.is_active_user()  to authenticated;
grant execute on function public.is_trusted()      to anon, authenticated;
grant execute on function public.search_listings(text, text, public.gender[], public.age_group[], text[],
  public.item_condition[], integer, integer, public.fulfillment_method, numeric, jsonb, jsonb, uuid, text, integer, integer)
  to anon, authenticated;
grant execute on function public.reserve_listing(uuid, public.fulfillment_method, jsonb, text) to authenticated;
grant execute on function public.seller_update_order(uuid, public.order_status, timestamptz, text) to authenticated;
grant execute on function public.buyer_confirm_order(uuid) to authenticated;
grant execute on function public.can_review_order(uuid) to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
-- Trigger/helper functions invoked inside client statements
grant execute on function public.validate_listing_attributes(uuid, jsonb, boolean) to authenticated;
grant execute on function public.set_updated_at() to authenticated;

-- Server-only (service role): mark_order_paid, release_reservation,
-- expire_stale_reservations, auto_complete_orders, refresh_seller_rating
grant execute on function public.mark_order_paid(uuid, text, text, text, integer) to service_role;
grant execute on function public.release_reservation(uuid, text)                  to service_role;
grant execute on function public.expire_stale_reservations()                      to service_role;
grant execute on function public.auto_complete_orders()                           to service_role;
grant execute on function public.refresh_seller_rating(uuid)                      to service_role;

-- ---------------------------------------------------------------------------
-- Storage: public-read listing photos; users write only under {their uid}/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "listing images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "listing images delete own" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "listing images update own" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
