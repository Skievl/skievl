-- =============================================================================
-- Migration 2: business-logic functions and triggers
--
-- Trust model:
--   * Browser clients connect as role `authenticated` / `anon` and are subject
--     to RLS + column grants + the guard triggers below.
--   * Server-only code (webhooks, admin actions) uses the `service_role` key.
--   * SECURITY DEFINER functions run as their owner (postgres).
--   is_trusted() is true for the latter two cases.
-- =============================================================================

create or replace function public.is_trusted() returns boolean
language sql stable as $$
  select current_user not in ('authenticated', 'anon');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_suspended
  );
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not is_suspended);
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(new.email, '@', 1), 'Skier'), 60)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: users cannot escalate their own role / suspension
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_trusted() then
    new.role := old.role;
    new.is_suspended := old.is_suspended;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Guard: Stripe status + rating aggregates are system-managed
create or replace function public.seller_profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_trusted() then
    if tg_op = 'INSERT' then
      new.stripe_account_id := null;
      new.charges_enabled := false;
      new.payouts_enabled := false;
      new.details_submitted := false;
      new.rating_avg := 0;
      new.rating_count := 0;
      new.sales_count := 0;
    else
      new.stripe_account_id := old.stripe_account_id;
      new.charges_enabled := old.charges_enabled;
      new.payouts_enabled := old.payouts_enabled;
      new.details_submitted := old.details_submitted;
      new.rating_avg := old.rating_avg;
      new.rating_count := old.rating_count;
      new.sales_count := old.sales_count;
    end if;
  end if;
  return new;
end $$;
create trigger seller_profiles_guard before insert or update on public.seller_profiles
  for each row execute function public.seller_profiles_guard();

-- ---------------------------------------------------------------------------
-- Listing attribute validation against attribute_definitions
-- ---------------------------------------------------------------------------
create or replace function public.validate_listing_attributes(
  p_category_id uuid, p_attrs jsonb, p_enforce_required boolean
) returns void
language plpgsql stable set search_path = public as $$
declare
  k text;
  v jsonb;
  def public.attribute_definitions%rowtype;
begin
  for k, v in select * from jsonb_each(p_attrs) loop
    select * into def from public.attribute_definitions
      where category_id = p_category_id and key = k;
    if not found then
      raise exception 'Attribute "%" is not valid for this category', k using errcode = '22023';
    end if;

    if v = 'null'::jsonb then
      raise exception 'Attribute "%" must not be null (omit it instead)', k using errcode = '22023';
    end if;

    if def.data_type in ('number', 'boot_size') then
      if jsonb_typeof(v) <> 'number' then
        raise exception '% must be a number', def.label using errcode = '22023';
      end if;
      if def.min_value is not null and (v #>> '{}')::numeric < def.min_value
         or def.max_value is not null and (v #>> '{}')::numeric > def.max_value then
        raise exception '% must be between % and %', def.label, def.min_value, def.max_value using errcode = '22023';
      end if;
    elsif def.data_type = 'boolean' then
      if jsonb_typeof(v) <> 'boolean' then
        raise exception '% must be yes or no', def.label using errcode = '22023';
      end if;
    elsif def.data_type = 'enum' then
      if jsonb_typeof(v) <> 'string' or not exists (
        select 1 from jsonb_array_elements(def.options) o where o ->> 'value' = v #>> '{}'
      ) then
        raise exception 'Invalid value for %', def.label using errcode = '22023';
      end if;
    end if;
  end loop;

  if p_enforce_required then
    for def in select * from public.attribute_definitions
               where category_id = p_category_id and is_required loop
      if not (p_attrs ? def.key) then
        raise exception '% is required', def.label using errcode = '22023';
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Listing guard: validation, search vector, and status state machine
-- ---------------------------------------------------------------------------
create or replace function public.listings_before_write() returns trigger
language plpgsql set search_path = public as $$
declare
  s public.platform_settings%rowtype;
  cat public.categories%rowtype;
  sp public.seller_profiles%rowtype;
  brand_name text;
  publishing boolean;
begin
  select * into s from public.platform_settings where id;
  select * into cat from public.categories where id = new.category_id;

  if not public.is_trusted() then
    -- System-managed columns
    if tg_op = 'INSERT' then
      if new.seller_id <> auth.uid() then
        raise exception 'Not allowed' using errcode = '42501';
      end if;
      new.approved_at := null;
      new.reserved_order_id := null;
      new.reserved_until := null;
      new.sold_at := null;
      new.published_at := null;
      new.rejection_reason := null;
    else
      new.seller_id := old.seller_id;
      new.approved_at := old.approved_at;
      new.reserved_order_id := old.reserved_order_id;
      new.reserved_until := old.reserved_until;
      new.sold_at := old.sold_at;
      new.published_at := old.published_at;
      new.rejection_reason := old.rejection_reason;
      new.created_at := old.created_at;

      if old.status in ('reserved', 'sold', 'removed') then
        raise exception 'This listing can no longer be edited (status: %)', old.status using errcode = '42501';
      end if;
    end if;

    -- Sellers may only choose these statuses; "active" is a publish request.
    if new.status not in ('draft', 'pending_review', 'active', 'unavailable') then
      raise exception 'Sellers cannot set status %', new.status using errcode = '42501';
    end if;

    publishing := new.status in ('active', 'pending_review');
    if publishing then
      select * into sp from public.seller_profiles where user_id = new.seller_id;
      if not sp.charges_enabled then
        raise exception 'Finish Stripe payout setup before publishing listings' using errcode = 'P0001';
      end if;
      if new.offers_pickup and not exists (select 1 from public.seller_private where user_id = new.seller_id) then
        raise exception 'Add your private pickup address before offering pickup' using errcode = 'P0001';
      end if;
      if new.offers_dropoff and not exists (select 1 from public.dropoff_areas where seller_id = new.seller_id) then
        raise exception 'Add at least one drop-off ZIP code before offering drop-off' using errcode = 'P0001';
      end if;
      if tg_op = 'UPDATE' and not exists (select 1 from public.listing_images where listing_id = new.id) then
        raise exception 'Add at least one photo before publishing' using errcode = 'P0001';
      end if;
      if tg_op = 'INSERT' then
        raise exception 'Save the listing as a draft and add photos before publishing' using errcode = 'P0001';
      end if;

      -- Approval workflow
      if s.require_listing_approval and new.approved_at is null then
        new.status := 'pending_review';
      else
        new.status := 'active';
      end if;
    end if;
  end if;

  -- Validation applies to everyone
  if new.price_cents > s.max_price_cents then
    raise exception 'Price exceeds the marketplace maximum' using errcode = '22023';
  end if;
  if new.offers_dropoff and new.dropoff_fee_cents > s.max_dropoff_fee_cents then
    raise exception 'Drop-off fee exceeds the marketplace maximum' using errcode = '22023';
  end if;
  if not new.offers_dropoff then
    new.dropoff_fee_cents := 0;
  end if;
  if not cat.uses_gender then new.gender := null; end if;
  if not cat.uses_age_group then new.age_group := null; end if;
  if new.brand_id is not null then new.brand_other := null; end if;

  perform public.validate_listing_attributes(
    new.category_id, new.attributes,
    new.status not in ('draft', 'unavailable', 'removed'));

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;

  select name into brand_name from public.brands where id = new.brand_id;
  new.search_vector :=
       setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple',  coalesce(brand_name, new.brand_other, '')), 'A')
    || setweight(to_tsvector('simple',  coalesce(new.model, '')), 'B')
    || setweight(to_tsvector('english', coalesce(cat.name, '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');

  return new;
end $$;

create trigger listings_before_write before insert or update on public.listings
  for each row execute function public.listings_before_write();

-- Sellers may delete only drafts (others are kept for order history)
create or replace function public.listings_before_delete() returns trigger
language plpgsql as $$
begin
  if not public.is_trusted() and old.status not in ('draft') then
    raise exception 'Only drafts can be deleted. Mark the listing unavailable instead.' using errcode = '42501';
  end if;
  if exists (select 1 from public.orders where listing_id = old.id) then
    raise exception 'Listing has orders and cannot be deleted' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger listings_before_delete before delete on public.listings
  for each row execute function public.listings_before_delete();

-- Max 12 photos per listing
create or replace function public.listing_images_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 12 then
    raise exception 'A listing can have at most 12 photos' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger listing_images_limit before insert on public.listing_images
  for each row execute function public.listing_images_limit();

-- ---------------------------------------------------------------------------
-- Seller rating aggregates
-- ---------------------------------------------------------------------------
create or replace function public.refresh_seller_rating(p_seller uuid) returns void
language sql security definer set search_path = public as $$
  update public.seller_profiles sp set
    rating_avg   = coalesce((select round(avg(rating_overall)::numeric, 2) from public.reviews
                             where seller_id = p_seller and status = 'published'), 0),
    rating_count = (select count(*) from public.reviews where seller_id = p_seller and status = 'published')
  where sp.user_id = p_seller;
$$;

create or replace function public.reviews_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_seller_rating(coalesce(new.seller_id, old.seller_id));
  return null;
end $$;
create trigger reviews_after_change after insert or update or delete on public.reviews
  for each row execute function public.reviews_after_change();

-- Reviewers can't moderate themselves
create or replace function public.reviews_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_trusted() then
    new.status := 'published';
    new.moderation_note := null;
  end if;
  return new;
end $$;
create trigger reviews_guard before insert on public.reviews
  for each row execute function public.reviews_guard();

-- Seller responses: sellers can't un-hide themselves
create or replace function public.seller_responses_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_trusted() then
    if tg_op = 'INSERT' then new.is_hidden := false;
    else new.is_hidden := old.is_hidden; new.review_id := old.review_id; new.seller_id := old.seller_id;
    end if;
  end if;
  return new;
end $$;
create trigger seller_responses_guard before insert or update on public.seller_responses
  for each row execute function public.seller_responses_guard();

-- ---------------------------------------------------------------------------
-- Messaging helpers
-- ---------------------------------------------------------------------------
create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------------
-- Checkout: reserve a listing (inventory lock) and create a pending order.
-- Called by the authenticated buyer via the checkout API route.
-- Atomic: the conditional UPDATE guarantees only one buyer can hold a listing.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_reservations() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    update public.orders set status = 'expired', cancel_reason = 'Checkout not completed in time'
    where status = 'pending_payment' and expires_at < now()
    returning id, listing_id
  ), released as (
    update public.listings l set status = 'active', reserved_order_id = null, reserved_until = null
    from expired e
    where l.id = e.listing_id and l.reserved_order_id = e.id and l.status = 'reserved'
    returning l.id
  )
  select count(*) into n from expired;
  return n;
end $$;

create or replace function public.reserve_listing(
  p_listing_id uuid,
  p_method public.fulfillment_method,
  p_dropoff_address jsonb default null,
  p_buyer_note text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_buyer uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_settings public.platform_settings%rowtype;
  v_order public.orders%rowtype;
  v_fee integer;
  v_dropoff_fee integer := 0;
  v_zip text;
  v_cover text;
  v_brand text;
begin
  if v_buyer is null then
    raise exception 'Sign in to buy' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is not able to make purchases' using errcode = '42501';
  end if;

  select * into v_settings from public.platform_settings where id;

  -- This buyer already holds the item (e.g. closed the Stripe tab and came back)
  select * into v_order from public.orders
   where listing_id = p_listing_id and buyer_id = v_buyer
     and status = 'pending_payment' and expires_at > now()
   order by created_at desc limit 1;
  if found then
    if v_order.fulfillment_method = 'pickup' and p_method = 'pickup'
       and v_order.expires_at > now() + interval '2 minutes' then
      return v_order; -- resume the same checkout session
    end if;
    -- Method/address changed or hold nearly over: replace it. If the old Stripe
    -- session is somehow still paid, mark_order_paid() detects the conflict and refunds.
    update public.orders set status = 'cancelled', cancel_reason = 'Replaced by new checkout'
      where id = v_order.id;
    update public.listings set status = 'active', reserved_order_id = null, reserved_until = null
      where id = p_listing_id and reserved_order_id = v_order.id;
  end if;

  -- Release any stale hold on this listing
  with expired as (
    update public.orders set status = 'expired', cancel_reason = 'Checkout not completed in time'
    where listing_id = p_listing_id and status = 'pending_payment' and expires_at < now()
    returning id
  )
  update public.listings l set status = 'active', reserved_order_id = null, reserved_until = null
    from expired e where l.id = p_listing_id and l.reserved_order_id = e.id;

  -- Lock the row
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'Sorry — this item is no longer available' using errcode = 'P0001';
  end if;
  if v_listing.seller_id = v_buyer then
    raise exception 'You cannot buy your own listing' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.seller_profiles where user_id = v_listing.seller_id and charges_enabled)
     or exists (select 1 from public.profiles where id = v_listing.seller_id and is_suspended) then
    raise exception 'This seller cannot accept payments right now' using errcode = 'P0001';
  end if;

  if p_method = 'pickup' then
    if not v_listing.offers_pickup then
      raise exception 'Pickup is not offered for this item' using errcode = 'P0001';
    end if;
  else
    if not v_listing.offers_dropoff then
      raise exception 'Drop-off is not offered for this item' using errcode = 'P0001';
    end if;
    v_zip := p_dropoff_address ->> 'postal_code';
    if v_zip is null or coalesce(p_dropoff_address ->> 'line1', '') = '' then
      raise exception 'A drop-off address is required' using errcode = '22023';
    end if;
    if not exists (select 1 from public.dropoff_areas where seller_id = v_listing.seller_id and postal_code = v_zip) then
      raise exception 'The seller does not drop off in ZIP code %', v_zip using errcode = 'P0001';
    end if;
    v_dropoff_fee := v_listing.dropoff_fee_cents;
  end if;

  v_fee := greatest(
    v_settings.min_platform_fee_cents,
    round((v_listing.price_cents
           + case when v_settings.commission_on_dropoff_fee then v_dropoff_fee else 0 end)
          * v_settings.commission_bps / 10000.0)::integer);
  v_fee := least(v_fee, v_listing.price_cents + v_dropoff_fee);

  select storage_path into v_cover from public.listing_images
    where listing_id = v_listing.id order by sort_order, created_at limit 1;
  select coalesce(b.name, v_listing.brand_other) into v_brand
    from (select 1) x left join public.brands b on b.id = v_listing.brand_id;

  insert into public.orders (
    listing_id, buyer_id, seller_id, status, fulfillment_method,
    item_price_cents, dropoff_fee_cents, commission_bps, platform_fee_cents,
    dropoff_address, buyer_note, listing_snapshot, expires_at
  ) values (
    v_listing.id, v_buyer, v_listing.seller_id, 'pending_payment', p_method,
    v_listing.price_cents, v_dropoff_fee, v_settings.commission_bps, v_fee,
    case when p_method = 'dropoff' then p_dropoff_address end,
    left(p_buyer_note, 1000),
    jsonb_build_object('title', v_listing.title, 'brand', v_brand, 'model', v_listing.model,
                       'condition', v_listing.condition, 'cover_image', v_cover,
                       'category_id', v_listing.category_id, 'attributes', v_listing.attributes),
    now() + make_interval(mins => v_settings.reservation_minutes)
  ) returning * into v_order;

  update public.listings
     set status = 'reserved', reserved_order_id = v_order.id, reserved_until = v_order.expires_at
   where id = v_listing.id;

  return v_order;
end $$;

-- Release a pending order (Stripe session expired, Stripe error, buyer cancelled)
create or replace function public.release_reservation(p_order_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'expired', cancel_reason = coalesce(p_reason, cancel_reason)
   where id = p_order_id and status = 'pending_payment';
  update public.listings set status = 'active', reserved_order_id = null, reserved_until = null
   where reserved_order_id = p_order_id and status = 'reserved';
end $$;

-- ---------------------------------------------------------------------------
-- Payment success (called by the Stripe webhook with the service role).
-- Returns 'ok', 'already_paid', or 'conflict' (item already sold elsewhere -> caller refunds).
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_amount_cents integer
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_listing public.listings%rowtype;
  v_addr jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;
  if v_order.paid_at is not null then
    return 'already_paid';
  end if;

  select * into v_listing from public.listings where id = v_order.listing_id for update;

  -- Record the payment regardless of outcome
  insert into public.payments (order_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, application_fee_cents, status)
  values (v_order.id, p_payment_intent_id, p_charge_id, p_amount_cents, v_order.platform_fee_cents, 'succeeded')
  on conflict (stripe_payment_intent_id) do nothing;

  -- Was the item still ours to sell?
  if v_listing.status = 'sold'
     or (v_listing.status = 'reserved' and v_listing.reserved_order_id <> v_order.id)
     or v_listing.status = 'removed' then
    update public.orders set
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      stripe_charge_id = p_charge_id,
      paid_at = now(),
      status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = 'Item was no longer available; payment refunded automatically'
    where id = v_order.id;
    return 'conflict';
  end if;

  if v_order.fulfillment_method = 'pickup' then
    select jsonb_build_object(
      'line1', address_line1, 'line2', address_line2, 'city', city, 'state', state,
      'postal_code', postal_code, 'instructions', pickup_instructions, 'phone', phone)
      into v_addr
      from public.seller_private where user_id = v_order.seller_id;
  end if;

  update public.orders set
    status = 'awaiting_fulfillment',
    stripe_checkout_session_id = p_session_id,
    stripe_payment_intent_id = p_payment_intent_id,
    stripe_charge_id = p_charge_id,
    paid_at = now(),
    pickup_address = v_addr
  where id = v_order.id;

  update public.listings set
    status = 'sold', sold_at = now(), reserved_order_id = v_order.id, reserved_until = null
  where id = v_listing.id;

  update public.seller_profiles set sales_count = sales_count + 1 where user_id = v_order.seller_id;

  -- Open a buyer/seller conversation so they can coordinate the handoff
  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (v_order.listing_id, v_order.buyer_id, v_order.seller_id)
  on conflict (listing_id, buyer_id) do nothing;

  return 'ok';
end $$;

-- ---------------------------------------------------------------------------
-- Fulfillment state machine
-- ---------------------------------------------------------------------------
create or replace function public.seller_update_order(
  p_order_id uuid,
  p_status public.order_status,
  p_scheduled_for timestamptz default null,
  p_note text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  allowed public.order_status[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.seller_id <> auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.fulfillment_method = 'pickup' then
    allowed := case v_order.status
      when 'awaiting_fulfillment' then array['ready_for_pickup','pickup_scheduled','picked_up']::public.order_status[]
      when 'ready_for_pickup'     then array['pickup_scheduled','picked_up']::public.order_status[]
      when 'pickup_scheduled'     then array['pickup_scheduled','ready_for_pickup','picked_up']::public.order_status[]
      else array[]::public.order_status[] end;
  else
    allowed := case v_order.status
      when 'awaiting_fulfillment' then array['delivery_scheduled','delivered']::public.order_status[]
      when 'delivery_scheduled'   then array['delivery_scheduled','delivered']::public.order_status[]
      else array[]::public.order_status[] end;
  end if;

  if not (p_status = any (allowed)) then
    raise exception 'Cannot change order from % to %', v_order.status, p_status using errcode = 'P0001';
  end if;

  update public.orders set
    status = p_status,
    scheduled_for = coalesce(p_scheduled_for, scheduled_for),
    seller_note = coalesce(nullif(trim(p_note), ''), seller_note),
    fulfilled_at = case when p_status in ('picked_up','delivered') then now() else fulfilled_at end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end $$;

-- Buyer confirms they received the item -> completed (unlocks review)
create or replace function public.buyer_confirm_order(p_order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('awaiting_fulfillment','ready_for_pickup','pickup_scheduled',
                            'delivery_scheduled','picked_up','delivered') then
    raise exception 'This order cannot be confirmed (status: %)', v_order.status using errcode = 'P0001';
  end if;
  update public.orders set status = 'completed', completed_at = now(),
         fulfilled_at = coalesce(fulfilled_at, now())
   where id = p_order_id returning * into v_order;
  return v_order;
end $$;

-- Auto-complete orders N days after the seller marks them picked up / delivered
create or replace function public.auto_complete_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer; d integer;
begin
  select auto_complete_days into d from public.platform_settings where id;
  update public.orders set status = 'completed', completed_at = now()
   where status in ('picked_up','delivered') and fulfilled_at < now() - make_interval(days => d);
  get diagnostics n = row_count;
  return n;
end $$;

-- Can the current user review this order?
create or replace function public.can_review_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.buyer_id = auth.uid() and o.status = 'completed'
      and not exists (select 1 from public.reviews r where r.order_id = o.id)
  );
$$;

-- Start (or fetch) a conversation about a listing
create or replace function public.start_conversation(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sign in to message sellers' using errcode = '42501';
  end if;
  select seller_id into v_seller from public.listings
   where id = p_listing_id and status in ('active','reserved','sold');
  if v_seller is null then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  if v_seller = auth.uid() then raise exception 'This is your listing' using errcode = 'P0001'; end if;
  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, auth.uid(), v_seller)
  on conflict (listing_id, buyer_id) do update set listing_id = excluded.listing_id
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Search. SECURITY INVOKER so RLS still applies.
-- p_attr_in:    {"ski_type":["powder","park"], "apparel_size":["M","L"]}
-- p_attr_range: {"length_cm":{"min":150,"max":170}, "boot_size":{"min":26,"max":27.5}}
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(
  p_q               text default null,
  p_category        text default null,
  p_genders         public.gender[] default null,
  p_age_groups      public.age_group[] default null,
  p_brands          text[] default null,     -- brand slugs; 'other' = unlisted brand
  p_conditions      public.item_condition[] default null,
  p_min_price_cents integer default null,
  p_max_price_cents integer default null,
  p_fulfillment     public.fulfillment_method default null,
  p_min_rating      numeric default null,
  p_attr_in         jsonb default null,
  p_attr_range      jsonb default null,
  p_seller          uuid default null,
  p_sort            text default 'relevance',
  p_limit           integer default 24,
  p_offset          integer default 0
) returns table (
  id uuid, title text, model text, price_cents integer, condition public.item_condition,
  gender public.gender, age_group public.age_group, attributes jsonb,
  offers_pickup boolean, offers_dropoff boolean, dropoff_fee_cents integer,
  published_at timestamptz, brand_name text, category_slug text, category_name text,
  seller_id uuid, seller_name text, seller_rating numeric, seller_rating_count integer,
  cover_image text, total_count bigint
)
language sql stable security invoker set search_path = public as $$
  with params as (
    select case when nullif(trim(p_q), '') is null then null
                else websearch_to_tsquery('english', p_q) end as tsq,
           nullif(trim(p_q), '') as raw,
           replace(replace(replace(coalesce(trim(p_q), ''), '\', '\\'), '%', '\%'), '_', '\_') as esc
  ),
  base as (
    select l.*, b.name as b_name, b.slug as b_slug, c.slug as c_slug, c.name as c_name,
           sp.shop_name, sp.rating_avg, sp.rating_count,
           case when p.tsq is null then 0 else ts_rank_cd(l.search_vector, p.tsq) end
             + case when p.raw is not null and l.title ilike '%' || p.esc || '%' then 0.1 else 0 end as rank
    from public.listings l
    cross join params p
    join public.categories c on c.id = l.category_id
    join public.seller_profiles sp on sp.user_id = l.seller_id
    left join public.brands b on b.id = l.brand_id
    where l.status = 'active'
      and (p.raw is null
           or l.search_vector @@ p.tsq
           or l.title ilike '%' || p.esc || '%'
           or coalesce(b.name, l.brand_other, '') ilike '%' || p.esc || '%'
           or coalesce(l.model, '') ilike '%' || p.esc || '%')
      and (p_category is null or c.slug = p_category)
      and (p_genders is null or cardinality(p_genders) = 0 or l.gender = any (p_genders)
           or (l.gender = 'unisex'))
      and (p_age_groups is null or cardinality(p_age_groups) = 0 or l.age_group = any (p_age_groups))
      and (p_brands is null or cardinality(p_brands) = 0
           or b.slug = any (p_brands)
           or ('other' = any (p_brands) and l.brand_id is null))
      and (p_conditions is null or cardinality(p_conditions) = 0 or l.condition = any (p_conditions))
      and (p_min_price_cents is null or l.price_cents >= p_min_price_cents)
      and (p_max_price_cents is null or l.price_cents <= p_max_price_cents)
      and (p_fulfillment is null
           or (p_fulfillment = 'pickup' and l.offers_pickup)
           or (p_fulfillment = 'dropoff' and l.offers_dropoff))
      and (p_min_rating is null or (sp.rating_count > 0 and sp.rating_avg >= p_min_rating))
      and (p_seller is null or l.seller_id = p_seller)
      and (p_attr_in is null or not exists (
            select 1 from jsonb_each(p_attr_in) a(key, vals)
            where jsonb_typeof(a.vals) = 'array' and jsonb_array_length(a.vals) > 0
              and not exists (
                select 1 from jsonb_array_elements(a.vals) v
                where l.attributes -> a.key = v)))
      and (p_attr_range is null or not exists (
            select 1 from jsonb_each(p_attr_range) r(key, rng)
            where case
              when jsonb_typeof(l.attributes -> r.key) is distinct from 'number' then true
              when jsonb_typeof(r.rng -> 'min') = 'number'
                   and (l.attributes ->> r.key)::numeric < (r.rng ->> 'min')::numeric then true
              when jsonb_typeof(r.rng -> 'max') = 'number'
                   and (l.attributes ->> r.key)::numeric > (r.rng ->> 'max')::numeric then true
              else false end))
  )
  select base.id, base.title, base.model, base.price_cents, base.condition,
         base.gender, base.age_group, base.attributes,
         base.offers_pickup, base.offers_dropoff, base.dropoff_fee_cents,
         base.published_at, coalesce(base.b_name, base.brand_other), base.c_slug, base.c_name,
         base.seller_id, base.shop_name, base.rating_avg, base.rating_count,
         (select li.storage_path from public.listing_images li
           where li.listing_id = base.id order by li.sort_order, li.created_at limit 1),
         count(*) over ()
  from base
  order by
    case when p_sort = 'price_asc'  then base.price_cents end asc nulls last,
    case when p_sort = 'price_desc' then base.price_cents end desc nulls last,
    case when p_sort = 'relevance'  then base.rank end desc nulls last,
    base.published_at desc nulls last,
    base.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
