-- Behavioural tests for schema, RLS and marketplace functions.
-- Runs on the local stub (see run_local.sh). Each failure raises an exception.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'seller@example.com', '{"display_name":"Sam Seller"}'),
  ('00000000-0000-0000-0000-00000000000b', 'buyer@example.com',  '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'buyer2@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@example.com',  '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000d';

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
exception when others then
  if sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
  raise notice 'ok (blocked): % -> %', label, sqlerrm;
end $$;

-- ---------------------------------------------------------------- seller setup
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;

do $$ begin
  assert (select display_name from public.profiles where id = auth.uid()) = 'Sam Seller', 'profile auto-created';
end $$;

insert into public.seller_profiles (user_id, shop_name) values (auth.uid(), 'Sam''s Gear Shed');
-- cannot self-enable payouts
select pg_temp.expect_error($q$ update public.seller_profiles set charges_enabled = true where user_id = auth.uid() $q$, 'self-enable payouts');
-- cannot self-promote
select pg_temp.expect_error($q$ update public.profiles set role = 'admin' where id = auth.uid() $q$, 'self-promote to admin');

insert into public.seller_private (user_id, address_line1, city, postal_code)
values (auth.uid(), '12 Washington St', 'Ellicottville', '14731');
insert into public.dropoff_areas (seller_id, postal_code, label) values (auth.uid(), '14731', 'Ellicottville');

-- draft listing with structured attributes
insert into public.listings (id, seller_id, category_id, brand_id, title, model, condition, price_cents,
                             gender, age_group, attributes, offers_pickup, offers_dropoff, dropoff_fee_cents)
select '10000000-0000-0000-0000-000000000001', auth.uid(), c.id, b.id, 'Rossignol Experience 86 skis', 'Experience 86 Ti',
       'good', 35000, 'mens', 'adult', '{"length_cm":176,"ski_type":"all_mountain","bindings_included":true}',
       true, true, 2500
from public.categories c, public.brands b where c.slug = 'skis' and b.slug = 'rossignol';

select pg_temp.expect_error($q$ update public.listings set attributes = '{"length_cm":176,"ski_type":"bogus"}' where id = '10000000-0000-0000-0000-000000000001' $q$, 'invalid enum attr');
select pg_temp.expect_error($q$ update public.listings set attributes = '{"boot_size":26.5}' where id = '10000000-0000-0000-0000-000000000001' $q$, 'attr from wrong category');
select pg_temp.expect_error($q$ update public.listings set attributes = '{"length_cm":999,"ski_type":"powder"}' where id = '10000000-0000-0000-0000-000000000001' $q$, 'attr out of range');
select pg_temp.expect_error($q$ update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001' $q$, 'publish before Stripe onboarding');

reset role;
update public.seller_profiles set charges_enabled = true, payouts_enabled = true
 where user_id = '00000000-0000-0000-0000-00000000000a';   -- simulates account.updated webhook
set role authenticated;

select pg_temp.expect_error($q$ update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001' $q$, 'publish without photo');
select pg_temp.expect_error($q$ insert into public.listing_images (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000001', 'someone-else/x.jpg') $q$, 'image path outside own folder');
insert into public.listing_images (listing_id, storage_path)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/a.jpg');
update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select status from public.listings where id = '10000000-0000-0000-0000-000000000001') = 'pending_review',
    'approval required -> pending_review';
end $$;
select pg_temp.expect_error($q$ update public.listings set status = 'sold' where id = '10000000-0000-0000-0000-000000000001' $q$, 'seller sets sold');

-- ---------------------------------------------------------------- admin approval (server action uses service role)
reset role;
set role service_role;
update public.listings set status = 'active', approved_at = now() where id = '10000000-0000-0000-0000-000000000001';
reset role;

-- ---------------------------------------------------------------- anonymous browse + search
select pg_temp.as_user('');
set role anon;
do $$ begin
  assert (select count(*) from public.search_listings(p_q => 'rossignol')) = 1, 'search by brand';
  assert (select count(*) from public.search_listings(p_q => 'experience')) = 1, 'search by model/title';
  assert (select count(*) from public.search_listings(p_category => 'skis',
          p_attr_range => '{"length_cm":{"min":170,"max":180}}')) = 1, 'length range hit';
  assert (select count(*) from public.search_listings(p_category => 'skis',
          p_attr_range => '{"length_cm":{"min":150,"max":160}}')) = 0, 'length range miss';
  assert (select count(*) from public.search_listings(p_attr_in => '{"ski_type":["powder","all_mountain"]}')) = 1, 'enum in';
  assert (select count(*) from public.search_listings(p_attr_range => '{"ski_type":{"min":1}}')) = 0, 'range on enum key is safe';
  assert (select count(*) from public.search_listings(p_genders => '{womens}')) = 0, 'gender filter';
  assert (select count(*) from public.search_listings(p_brands => '{rossignol,other}', p_max_price_cents => 40000)) = 1, 'brand+price';
  assert (select count(*) from public.search_listings(p_min_rating => 4)) = 0, 'rating filter (no reviews yet)';
  assert (select count(*) from public.search_listings(p_q => '100%_off')) = 0, 'wildcards escaped';
end $$;
select pg_temp.expect_error($q$ select * from public.seller_private $q$, 'anon reads private address');
select pg_temp.expect_error($q$ select * from public.orders $q$, 'anon reads orders');
reset role;

-- ---------------------------------------------------------------- buyer checkout + inventory lock
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.seller_private) = 0, 'buyer cannot see seller address';
end $$;
select pg_temp.expect_error($q$ select public.reserve_listing('10000000-0000-0000-0000-000000000001', 'dropoff', '{"line1":"1 Main","postal_code":"14760"}') $q$, 'drop-off outside service area');

create temp table t_order as
  select * from public.reserve_listing('10000000-0000-0000-0000-000000000001', 'dropoff',
                                       '{"line1":"5 Elm St","city":"Ellicottville","postal_code":"14731"}');
do $$ declare o record; begin
  select * into o from t_order;
  assert o.item_price_cents = 35000 and o.dropoff_fee_cents = 2500, 'fee breakdown';
  assert o.total_cents = 37500, 'total';
  assert o.platform_fee_cents = 2800, 'commission 8% of item only';
  assert o.seller_proceeds_cents = 34700, 'seller proceeds';
  assert o.pickup_address is null, 'no address before payment';
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.expect_error($q$ select public.reserve_listing('10000000-0000-0000-0000-000000000001', 'pickup') $q$, 'second buyer blocked by lock');
do $$ begin assert (select count(*) from public.orders) = 0, 'buyer2 cannot see buyer1 order'; end $$;
reset role;

-- reservation expiry releases the item
update public.orders set expires_at = now() - interval '1 minute' where id = (select id from t_order);
set role service_role;
select public.expire_stale_reservations();
reset role;
do $$ begin
  assert (select status from public.listings where id = '10000000-0000-0000-0000-000000000001') = 'active', 'released';
end $$;

-- buyer 1 tries again with pickup and pays
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
drop table t_order;
create temp table t_order as select * from public.reserve_listing('10000000-0000-0000-0000-000000000001', 'pickup');
do $$ begin
  assert (select id from public.reserve_listing('10000000-0000-0000-0000-000000000001', 'pickup')) = (select id from t_order), 'holder resumes same order';
  assert (select fulfillment_method from public.reserve_listing('10000000-0000-0000-0000-000000000001', 'dropoff',
          '{"line1":"5 Elm St","postal_code":"14731"}')) = 'dropoff', 'holder can switch method';
end $$;
drop table t_order;
create temp table t_order as select * from public.reserve_listing('10000000-0000-0000-0000-000000000001', 'pickup');
reset role;
grant select on t_order to service_role;
set role service_role;
do $$ begin
  assert public.mark_order_paid((select id from t_order), 'cs_test', 'pi_test', 'ch_test', 35000) = 'ok', 'paid';
  assert public.mark_order_paid((select id from t_order), 'cs_test', 'pi_test', 'ch_test', 35000) = 'already_paid', 'idempotent';
end $$;
reset role;

set role authenticated;
do $$ declare o record; begin
  select * into o from public.orders where id = (select id from t_order);
  assert o.status = 'awaiting_fulfillment', 'awaiting fulfillment';
  assert o.pickup_address ->> 'line1' = '12 Washington St', 'buyer gets address after payment';
  assert (select status from public.listings where id = o.listing_id) = 'sold', 'listing sold';
  assert (select count(*) from public.conversations where listing_id = o.listing_id) = 1, 'conversation opened';
end $$;
select pg_temp.expect_error($q$ select public.seller_update_order((select id from t_order), 'picked_up') $q$, 'buyer cannot act as seller');
select pg_temp.expect_error($q$ insert into public.reviews (order_id, buyer_id, seller_id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body)
  select id, buyer_id, seller_id, 5,5,5,5, 'Great seller, easy pickup.' from t_order $q$, 'review before completion');
reset role;

-- seller fulfills
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.expect_error($q$ select public.seller_update_order((select id from t_order), 'delivered') $q$, 'invalid transition for pickup');
select status from public.seller_update_order((select id from t_order), 'pickup_scheduled', now() + interval '1 day', 'Sat 9am works');
select status from public.seller_update_order((select id from t_order), 'picked_up');
reset role;

-- buyer confirms and reviews
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select status from public.buyer_confirm_order((select id from t_order));
insert into public.reviews (order_id, buyer_id, seller_id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body)
  select id, buyer_id, seller_id, 4, 5, 4, 5, 'Skis exactly as described, quick pickup.' from t_order;
select pg_temp.expect_error($q$ insert into public.reviews (order_id, buyer_id, seller_id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body)
  select id, buyer_id, seller_id, 5,5,5,5, 'Second review attempt here' from t_order $q$, 'one review per order');
reset role;

select set_config('test.order_id', (select id::text from t_order), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.expect_error($q$ insert into public.reviews (order_id, buyer_id, seller_id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body)
  values (current_setting('test.order_id')::uuid, auth.uid(), '00000000-0000-0000-0000-00000000000a', 1,1,1,1, 'Fake review from non-buyer') $q$, 'non-buyer review');
reset role;

do $$ begin
  assert (select rating_avg from public.seller_profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 4.00, 'rating avg';
  assert (select rating_count from public.seller_profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'rating count';
  assert (select sales_count from public.seller_profiles where user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'sales count';
end $$;

-- seller responds publicly
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.seller_responses (review_id, seller_id, body)
  select id, auth.uid(), 'Thanks — enjoy the skis!' from public.reviews limit 1;
select pg_temp.expect_error($q$ update public.listings set title = 'changed' where id = '10000000-0000-0000-0000-000000000001' $q$, 'edit sold listing');
reset role;

-- conflict path: payment arrives for an order whose item already sold
insert into public.orders (listing_id, buyer_id, seller_id, fulfillment_method, item_price_cents, commission_bps, platform_fee_cents, listing_snapshot, expires_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a',
        'pickup', 35000, 800, 2800, '{}', now() + interval '30 min');
set role service_role;
do $$ begin
  assert public.mark_order_paid((select id from public.orders where buyer_id = '00000000-0000-0000-0000-00000000000c'),
         'cs_2', 'pi_2', 'ch_2', 35000) = 'conflict', 'double-sale detected -> refund';
end $$;
reset role;

-- admin can read everything they need
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
set role authenticated;
do $$ begin
  assert (select count(*) from public.orders) >= 5, 'admin sees every order';
  assert (select count(*) from public.seller_private) = 0, 'admin does not see private addresses via client';
end $$;
reset role;
