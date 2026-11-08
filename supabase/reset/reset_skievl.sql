-- DANGER: deletes ALL SKIEVL tables and data. Only for a fresh/test database.
-- Safe to run on an empty database. Afterwards run migrations 1-4 in order.
drop policy if exists "listing images upload own folder" on storage.objects;
drop policy if exists "listing images delete own" on storage.objects;
drop policy if exists "listing images update own" on storage.objects;
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists
  public.admin_audit_log, public.notifications, public.reports, public.messages, public.conversations,
  public.seller_responses, public.reviews, public.stripe_events, public.payouts, public.disputes,
  public.refunds, public.payments, public.favorites, public.listing_images, public.orders, public.listings,
  public.platform_settings, public.brands, public.attribute_definitions, public.categories,
  public.dropoff_areas, public.seller_private, public.seller_profiles, public.profiles
  cascade;
drop sequence if exists public.order_number_seq;
drop function if exists
  public.set_updated_at, public.is_trusted, public.is_admin, public.is_active_user, public.handle_new_user,
  public.profiles_guard, public.seller_profiles_guard, public.listings_before_write, public.listings_before_delete,
  public.listing_images_limit, public.refresh_seller_rating, public.reviews_after_change, public.reviews_guard,
  public.seller_responses_guard, public.messages_after_insert, public.expire_stale_reservations,
  public.release_reservation, public.auto_complete_orders, public.can_review_order, public.start_conversation,
  public.is_listing_buyer, public.mark_order_paid
  cascade;
drop type if exists
  public.user_role, public.listing_status, public.item_condition, public.gender, public.age_group,
  public.fulfillment_method, public.order_status, public.review_status, public.report_status,
  public.report_target, public.attribute_type
  cascade;
drop function if exists public.validate_listing_attributes(uuid, jsonb, boolean) cascade;
