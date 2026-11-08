-- =============================================================================
-- SKIEVL.com — Ellicottville Ski Exchange
-- Migration 1: core schema (types, tables, indexes)
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('user', 'admin');
create type public.listing_status    as enum ('draft', 'pending_review', 'active', 'reserved', 'sold', 'unavailable', 'removed');
create type public.item_condition    as enum ('new', 'like_new', 'good', 'fair');
create type public.gender            as enum ('mens', 'womens', 'unisex');
create type public.age_group         as enum ('adult', 'youth', 'kids', 'toddler');
create type public.fulfillment_method as enum ('pickup', 'dropoff');
create type public.order_status      as enum (
  'pending_payment',      -- reservation held, buyer in Stripe Checkout
  'awaiting_fulfillment', -- paid; seller must prepare item
  'ready_for_pickup',
  'pickup_scheduled',
  'delivery_scheduled',   -- seller drop-off arranged
  'shipped',              -- reserved for future use; not used at launch
  'delivered',
  'picked_up',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'expired'               -- checkout abandoned, reservation released
);
create type public.review_status  as enum ('published', 'hidden', 'removed');
create type public.report_status  as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_target  as enum ('listing', 'user', 'review', 'message');
create type public.attribute_type as enum ('enum', 'number', 'boolean', 'boot_size');

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Users / profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  avatar_url    text,
  home_town     text check (char_length(home_town) <= 80),
  role          public.user_role not null default 'user',
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.seller_profiles (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  shop_name          text not null check (char_length(shop_name) between 2 and 60),
  bio                text check (char_length(bio) <= 1000),
  town               text not null default 'Ellicottville' check (char_length(town) <= 80),
  stripe_account_id  text unique,
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  details_submitted  boolean not null default false,
  rating_avg         numeric(3,2) not null default 0,
  rating_count       integer not null default 0,
  sales_count        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger seller_profiles_updated_at before update on public.seller_profiles
  for each row execute function public.set_updated_at();
create index seller_profiles_rating_idx on public.seller_profiles (rating_avg desc);

-- Private seller data. Never readable by anyone but the seller (and the service
-- role). The pickup address is copied onto an order only after payment succeeds.
create table public.seller_private (
  user_id              uuid primary key references public.seller_profiles (user_id) on delete cascade,
  address_line1        text not null check (char_length(address_line1) <= 120),
  address_line2        text check (char_length(address_line2) <= 120),
  city                 text not null check (char_length(city) <= 80),
  state                text not null default 'NY' check (char_length(state) = 2),
  postal_code          text not null check (postal_code ~ '^\d{5}$'),
  pickup_instructions  text check (char_length(pickup_instructions) <= 500),
  phone                text check (char_length(phone) <= 30),
  updated_at           timestamptz not null default now()
);
create trigger seller_private_updated_at before update on public.seller_private
  for each row execute function public.set_updated_at();

-- Seller drop-off service area, defined as a list of ZIP codes.
create table public.dropoff_areas (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.seller_profiles (user_id) on delete cascade,
  postal_code  text not null check (postal_code ~ '^\d{5}$'),
  label        text check (char_length(label) <= 80),
  created_at   timestamptz not null default now(),
  unique (seller_id, postal_code)
);

-- ---------------------------------------------------------------------------
-- Catalog: categories, category-specific attributes, brands
-- ---------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name            text not null,
  description     text,
  uses_gender     boolean not null default true,
  uses_age_group  boolean not null default true,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Structured, category-specific attributes (e.g. ski length, Mondo boot size,
-- apparel size). Listing values are stored in listings.attributes (jsonb) and
-- validated against these definitions by trigger.
create table public.attribute_definitions (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id) on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label        text not null,
  data_type    public.attribute_type not null,
  unit         text,
  options      jsonb,          -- enum: [{"value":"powder","label":"Powder"}]
  min_value    numeric,
  max_value    numeric,
  step         numeric,
  is_required  boolean not null default false,
  is_filterable boolean not null default true,
  is_size      boolean not null default false, -- shown as the item's "size"
  sort_order   integer not null default 0,
  unique (category_id, key),
  check (data_type <> 'enum' or jsonb_typeof(options) = 'array')
);

create table public.brands (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null unique,
  is_featured  boolean not null default false,
  is_active    boolean not null default true,
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Platform settings (single row)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id                        boolean primary key default true check (id),
  commission_bps            integer not null default 800 check (commission_bps between 0 and 5000), -- 800 = 8.00% (PLACEHOLDER)
  min_platform_fee_cents    integer not null default 0 check (min_platform_fee_cents >= 0),
  commission_on_dropoff_fee boolean not null default false,
  require_listing_approval  boolean not null default true,
  reservation_minutes       integer not null default 35 check (reservation_minutes between 33 and 120),
  auto_complete_days        integer not null default 3 check (auto_complete_days between 1 and 30),
  max_dropoff_fee_cents     integer not null default 10000 check (max_dropoff_fee_cents >= 0),
  max_price_cents           integer not null default 500000 check (max_price_cents > 0),
  market_name               text not null default 'Ellicottville',
  support_email             text not null default 'support@skievl.com',
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles (id)
);
insert into public.platform_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.seller_profiles (user_id) on delete cascade,
  category_id        uuid not null references public.categories (id),
  brand_id           uuid references public.brands (id),
  brand_other        text check (char_length(brand_other) <= 60),
  title              text not null check (char_length(title) between 3 and 100),
  model              text check (char_length(model) <= 100),
  model_year         integer check (model_year between 1970 and 2100),
  description        text not null default '' check (char_length(description) <= 5000),
  condition          public.item_condition not null,
  condition_notes    text check (char_length(condition_notes) <= 1000),
  price_cents        integer not null check (price_cents >= 100),
  gender             public.gender,
  age_group          public.age_group,
  attributes         jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  offers_pickup      boolean not null default true,
  offers_dropoff     boolean not null default false,
  dropoff_fee_cents  integer not null default 0 check (dropoff_fee_cents >= 0),
  status             public.listing_status not null default 'draft',
  approved_at        timestamptz,
  rejection_reason   text,
  reserved_order_id  uuid,
  reserved_until     timestamptz,
  published_at       timestamptz,
  sold_at            timestamptz,
  search_vector      tsvector,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint listings_fulfillment_chk check (offers_pickup or offers_dropoff)
);
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create index listings_status_published_idx on public.listings (status, published_at desc);
create index listings_category_idx         on public.listings (category_id) where status = 'active';
create index listings_brand_idx            on public.listings (brand_id)    where status = 'active';
create index listings_price_idx            on public.listings (price_cents) where status = 'active';
create index listings_seller_idx           on public.listings (seller_id, status);
create index listings_attributes_idx       on public.listings using gin (attributes jsonb_path_ops);
create index listings_search_idx           on public.listings using gin (search_vector);
create index listings_title_trgm_idx       on public.listings using gin (title extensions.gin_trgm_ops);

create table public.listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  storage_path  text not null unique,
  sort_order    integer not null default 0,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);
create index listing_images_listing_idx on public.listing_images (listing_id, sort_order);

create table public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

-- ---------------------------------------------------------------------------
-- Orders and money movement
-- One unique used item per order (peer-to-peer). Fulfillment is per seller.
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  order_number                text not null unique default ('EVL-' || nextval('public.order_number_seq')),
  listing_id                  uuid not null references public.listings (id),
  buyer_id                    uuid not null references public.profiles (id),
  seller_id                   uuid not null references public.seller_profiles (user_id),
  status                      public.order_status not null default 'pending_payment',
  fulfillment_method          public.fulfillment_method not null,
  -- Financial breakdown (all USD cents). Item and drop-off fee recorded separately.
  item_price_cents            integer not null check (item_price_cents >= 0),
  dropoff_fee_cents           integer not null default 0 check (dropoff_fee_cents >= 0),
  total_cents                 integer generated always as (item_price_cents + dropoff_fee_cents) stored,
  commission_bps              integer not null,
  platform_fee_cents          integer not null check (platform_fee_cents >= 0),
  seller_proceeds_cents       integer generated always as (item_price_cents + dropoff_fee_cents - platform_fee_cents) stored,
  refunded_cents              integer not null default 0,
  -- Fulfillment details
  dropoff_address             jsonb,  -- buyer-provided delivery address (drop-off only)
  pickup_address              jsonb,  -- seller address snapshot, set ONLY after successful payment
  scheduled_for               timestamptz,
  seller_note                 text check (char_length(seller_note) <= 1000),
  buyer_note                  text check (char_length(buyer_note) <= 1000),
  listing_snapshot            jsonb not null,
  -- Stripe references
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text unique,
  stripe_charge_id            text unique,
  -- Timeline
  expires_at                  timestamptz,
  paid_at                     timestamptz,
  fulfilled_at                timestamptz,
  completed_at                timestamptz,
  cancelled_at                timestamptz,
  cancel_reason               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check (fulfillment_method = 'dropoff' or dropoff_fee_cents = 0)
);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create index orders_buyer_idx   on public.orders (buyer_id, created_at desc);
create index orders_seller_idx  on public.orders (seller_id, created_at desc);
create index orders_status_idx  on public.orders (status);
create index orders_pending_idx on public.orders (expires_at) where status = 'pending_payment';

alter table public.listings
  add constraint listings_reserved_order_fk foreign key (reserved_order_id)
  references public.orders (id) on delete set null;

create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id),
  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  amount_cents              integer not null,
  application_fee_cents     integer not null,
  currency                  text not null default 'usd',
  status                    text not null,
  created_at                timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id),
  stripe_refund_id text unique,
  amount_cents     integer not null check (amount_cents > 0),
  reason           text,
  status           text not null default 'pending',
  initiated_by     uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);

create table public.disputes (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid references public.orders (id),
  stripe_dispute_id  text not null unique,
  stripe_charge_id   text,
  amount_cents       integer not null,
  reason             text,
  status             text not null,
  evidence_due_by    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger disputes_updated_at before update on public.disputes
  for each row execute function public.set_updated_at();

create table public.payouts (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid references public.seller_profiles (user_id),
  stripe_account_id text not null,
  stripe_payout_id  text not null unique,
  amount_cents      integer not null,
  currency          text not null default 'usd',
  status            text not null,
  arrival_date      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger payouts_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();
create index payouts_seller_idx on public.payouts (seller_id, created_at desc);

-- Webhook idempotency log
create table public.stripe_events (
  id            text primary key,
  type          text not null,
  account       text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

-- ---------------------------------------------------------------------------
-- Reviews (seller experience, tied 1:1 to a completed order)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null unique references public.orders (id),
  buyer_id              uuid not null references public.profiles (id),
  seller_id             uuid not null references public.seller_profiles (user_id),
  rating_overall        smallint not null check (rating_overall between 1 and 5),
  rating_communication  smallint not null check (rating_communication between 1 and 5),
  rating_accuracy       smallint not null check (rating_accuracy between 1 and 5),
  rating_transaction    smallint not null check (rating_transaction between 1 and 5),
  body                  text not null check (char_length(body) between 10 and 2000),
  status                public.review_status not null default 'published',
  moderation_note       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create index reviews_seller_idx on public.reviews (seller_id, created_at desc) where status = 'published';

create table public.seller_responses (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null unique references public.reviews (id) on delete cascade,
  seller_id   uuid not null references public.seller_profiles (user_id),
  body        text not null check (char_length(body) between 2 and 1000),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger seller_responses_updated_at before update on public.seller_responses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Messaging, reports, notifications, audit
-- ---------------------------------------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings (id) on delete cascade,
  buyer_id         uuid not null references public.profiles (id) on delete cascade,
  seller_id        uuid not null references public.seller_profiles (user_id) on delete cascade,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx  on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  target_type      public.report_target not null,
  target_id        uuid not null,
  reason           text not null check (reason in ('prohibited_item','scam_or_fraud','misleading','offensive','harassment','fake_review','other')),
  details          text check (char_length(details) <= 2000),
  status           public.report_status not null default 'open',
  resolved_by      uuid references public.profiles (id),
  resolution_note  text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index reports_status_idx on public.reports (status, created_at desc);
create unique index reports_one_open_per_user on public.reports (reporter_id, target_type, target_id) where status in ('open','reviewing');

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles (id),
  action       text not null,
  target_type  text,
  target_id    text,
  details      jsonb,
  created_at   timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
