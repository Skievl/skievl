// Hand-maintained types mirroring the database. For full coverage, generate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type ListingStatus = "draft" | "pending_review" | "active" | "reserved" | "sold" | "unavailable" | "removed";
export type ItemCondition = "new" | "like_new" | "good" | "fair";
export type Gender = "mens" | "womens" | "unisex";
export type AgeGroup = "adult" | "youth" | "kids" | "toddler";
export type FulfillmentMethod = "pickup" | "dropoff";
export type OrderStatus =
  | "pending_payment"
  | "awaiting_fulfillment"
  | "ready_for_pickup"
  | "pickup_scheduled"
  | "delivery_scheduled"
  | "shipped"
  | "delivered"
  | "picked_up"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed"
  | "expired";
export type AttributeType = "enum" | "number" | "boolean" | "boot_size";

export interface AttributeOption {
  value: string;
  label: string;
}

export interface AttributeDefinition {
  id: string;
  category_id: string;
  key: string;
  label: string;
  data_type: AttributeType;
  unit: string | null;
  options: AttributeOption[] | null;
  min_value: number | null;
  max_value: number | null;
  step: number | null;
  is_required: boolean;
  is_filterable: boolean;
  is_size: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  uses_gender: boolean;
  uses_age_group: boolean;
  sort_order: number;
  is_active: boolean;
  attribute_definitions: AttributeDefinition[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
}

export type Attributes = Record<string, string | number | boolean>;

export interface Listing {
  id: string;
  seller_id: string;
  category_id: string;
  brand_id: string | null;
  brand_other: string | null;
  title: string;
  model: string | null;
  model_year: number | null;
  description: string;
  condition: ItemCondition;
  condition_notes: string | null;
  price_cents: number;
  gender: Gender | null;
  age_group: AgeGroup | null;
  attributes: Attributes;
  offers_pickup: boolean;
  offers_dropoff: boolean;
  dropoff_fee_cents: number;
  status: ListingStatus;
  approved_at: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  sort_order: number;
}

export interface SearchResult {
  id: string;
  title: string;
  model: string | null;
  price_cents: number;
  condition: ItemCondition;
  gender: Gender | null;
  age_group: AgeGroup | null;
  attributes: Attributes;
  offers_pickup: boolean;
  offers_dropoff: boolean;
  dropoff_fee_cents: number;
  published_at: string | null;
  brand_name: string | null;
  category_slug: string;
  category_name: string;
  seller_id: string;
  seller_name: string;
  seller_rating: number;
  seller_rating_count: number;
  cover_image: string | null;
  total_count: number;
}

export interface SellerProfile {
  user_id: string;
  shop_name: string;
  bio: string | null;
  town: string;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  created_at: string;
}

export interface Address {
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code: string;
  instructions?: string | null;
  phone?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  fulfillment_method: FulfillmentMethod;
  item_price_cents: number;
  dropoff_fee_cents: number;
  total_cents: number;
  commission_bps: number;
  platform_fee_cents: number;
  seller_proceeds_cents: number;
  refunded_cents: number;
  dropoff_address: Address | null;
  pickup_address: Address | null;
  scheduled_for: string | null;
  seller_note: string | null;
  buyer_note: string | null;
  listing_snapshot: {
    title: string;
    brand: string | null;
    model: string | null;
    condition: ItemCondition;
    cover_image: string | null;
  };
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  rating_overall: number;
  rating_communication: number;
  rating_accuracy: number;
  rating_transaction: number;
  body: string;
  status: "published" | "hidden" | "removed";
  created_at: string;
}

export interface PlatformSettings {
  commission_bps: number;
  min_platform_fee_cents: number;
  commission_on_dropoff_fee: boolean;
  require_listing_approval: boolean;
  reservation_minutes: number;
  auto_complete_days: number;
  max_dropoff_fee_cents: number;
  max_price_cents: number;
  market_name: string;
  support_email: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
