-- =============================================================================
-- Migration 4: reference data — categories, category-specific attributes, brands
-- Admins can edit categories/brands later from /admin/catalog.
-- =============================================================================

insert into public.categories (slug, name, uses_gender, uses_age_group, sort_order) values
  ('skis',              'Skis',               true,  true,  10),
  ('snowboards',        'Snowboards',         true,  true,  20),
  ('ski-boots',         'Ski Boots',          true,  true,  30),
  ('snowboard-boots',   'Snowboard Boots',    true,  true,  40),
  ('bindings',          'Bindings',           false, true,  50),
  ('helmets',           'Helmets',            false, true,  60),
  ('goggles',           'Goggles',            false, true,  70),
  ('ski-apparel',       'Ski Apparel',        true,  true,  80),
  ('snowboard-apparel', 'Snowboard Apparel',  true,  true,  90),
  ('jackets-pants',     'Jackets & Pants',    true,  true, 100),
  ('gloves-mittens',    'Gloves & Mittens',   true,  true, 110),
  ('poles',             'Poles',              false, true, 120),
  ('accessories',       'Accessories',        false, false, 130),
  ('other',             'Other Equipment',    false, false, 140);

-- Helper to insert attribute definitions by category slug
create temporary table _attr (
  cat text, key text, label text, data_type public.attribute_type, unit text, options jsonb,
  min_value numeric, max_value numeric, step numeric, is_required boolean, is_size boolean, sort_order int
);

insert into _attr values
  -- Skis
  ('skis', 'length_cm', 'Ski length', 'number', 'cm', null, 60, 215, 1, true, true, 10),
  ('skis', 'ski_type', 'Ski type', 'enum', null,
   '[{"value":"all_mountain","label":"All-mountain"},{"value":"on_piste","label":"On-piste / carving"},
     {"value":"powder","label":"Powder / freeride"},{"value":"park","label":"Park / freestyle"},
     {"value":"touring","label":"Backcountry / touring"},{"value":"race","label":"Race"},
     {"value":"cross_country","label":"Cross-country"}]', null, null, null, true, false, 20),
  ('skis', 'waist_mm', 'Waist width', 'number', 'mm', null, 40, 140, 1, false, false, 30),
  ('skis', 'bindings_included', 'Bindings included', 'boolean', null, null, null, null, null, false, false, 40),
  -- Snowboards
  ('snowboards', 'length_cm', 'Board length', 'number', 'cm', null, 70, 180, 1, true, true, 10),
  ('snowboards', 'board_type', 'Board type', 'enum', null,
   '[{"value":"all_mountain","label":"All-mountain"},{"value":"freestyle","label":"Freestyle / park"},
     {"value":"freeride","label":"Freeride / powder"},{"value":"splitboard","label":"Splitboard"}]',
   null, null, null, true, false, 20),
  ('snowboards', 'width', 'Width', 'enum', null,
   '[{"value":"regular","label":"Regular"},{"value":"mid_wide","label":"Mid-wide"},{"value":"wide","label":"Wide"}]',
   null, null, null, false, false, 30),
  ('snowboards', 'bindings_included', 'Bindings included', 'boolean', null, null, null, null, null, false, false, 40),
  -- Ski boots (canonical size = Mondopoint cm; UI converts to/from US sizes)
  ('ski-boots', 'boot_size', 'Boot size (Mondo)', 'boot_size', 'mondo', null, 15, 33.5, 0.5, true, true, 10),
  ('ski-boots', 'flex', 'Flex', 'number', null, null, 40, 150, 5, false, false, 20),
  ('ski-boots', 'last_mm', 'Last width', 'number', 'mm', null, 92, 106, 1, false, false, 30),
  -- Snowboard boots
  ('snowboard-boots', 'boot_size', 'Boot size (Mondo)', 'boot_size', 'mondo', null, 15, 33.5, 0.5, true, true, 10),
  ('snowboard-boots', 'lacing', 'Lacing', 'enum', null,
   '[{"value":"traditional","label":"Traditional laces"},{"value":"boa","label":"BOA"},{"value":"speed","label":"Speed lace"}]',
   null, null, null, false, false, 20),
  -- Bindings
  ('bindings', 'binding_for', 'Binding type', 'enum', null,
   '[{"value":"alpine_ski","label":"Alpine ski"},{"value":"touring_ski","label":"Touring ski"},{"value":"snowboard","label":"Snowboard"}]',
   null, null, null, true, false, 10),
  ('bindings', 'binding_size', 'Binding size', 'enum', null,
   '[{"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"one_size","label":"Adjustable / one size"}]',
   null, null, null, false, true, 20),
  ('bindings', 'din_max', 'Max DIN', 'number', null, null, 3, 20, 0.5, false, false, 30),
  -- Helmets
  ('helmets', 'helmet_size', 'Helmet size', 'enum', null,
   '[{"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"}]',
   null, null, null, true, true, 10),
  ('helmets', 'circumference_cm', 'Head circumference', 'number', 'cm', null, 44, 66, 1, false, false, 20),
  ('helmets', 'mips', 'MIPS', 'boolean', null, null, null, null, null, false, false, 30),
  -- Goggles
  ('goggles', 'frame_size', 'Frame size', 'enum', null,
   '[{"value":"small","label":"Small / youth"},{"value":"medium","label":"Medium"},{"value":"large","label":"Large"}]',
   null, null, null, false, true, 10),
  ('goggles', 'otg', 'Fits over glasses (OTG)', 'boolean', null, null, null, null, null, false, false, 20),
  -- Apparel (shared size scale)
  ('ski-apparel', 'apparel_size', 'Size', 'enum', null, null, null, null, null, true, true, 10),
  ('ski-apparel', 'garment', 'Garment', 'enum', null, null, null, null, null, true, false, 20),
  ('snowboard-apparel', 'apparel_size', 'Size', 'enum', null, null, null, null, null, true, true, 10),
  ('snowboard-apparel', 'garment', 'Garment', 'enum', null, null, null, null, null, true, false, 20),
  ('jackets-pants', 'apparel_size', 'Size', 'enum', null, null, null, null, null, true, true, 10),
  ('jackets-pants', 'garment', 'Garment', 'enum', null, null, null, null, null, true, false, 20),
  -- Gloves
  ('gloves-mittens', 'glove_size', 'Size', 'enum', null,
   '[{"value":"youth_xs","label":"Youth XS"},{"value":"youth_s","label":"Youth S"},{"value":"youth_m","label":"Youth M"},{"value":"youth_l","label":"Youth L"},
     {"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"XXL","label":"XXL"}]',
   null, null, null, true, true, 10),
  ('gloves-mittens', 'style', 'Style', 'enum', null,
   '[{"value":"glove","label":"Glove"},{"value":"mitten","label":"Mitten"},{"value":"trigger","label":"Trigger / 3-finger"}]',
   null, null, null, false, false, 20),
  -- Poles
  ('poles', 'pole_length_cm', 'Pole length', 'number', 'cm', null, 70, 150, 5, true, true, 10);

update _attr set options =
 '[{"value":"toddler_2t","label":"2T"},{"value":"toddler_3t","label":"3T"},{"value":"toddler_4t","label":"4T"},
   {"value":"youth_xs","label":"Youth XS (4-5)"},{"value":"youth_s","label":"Youth S (6-7)"},{"value":"youth_m","label":"Youth M (8-10)"},
   {"value":"youth_l","label":"Youth L (12-14)"},{"value":"youth_xl","label":"Youth XL (16-18)"},
   {"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"XXL","label":"XXL"}]'
 where key = 'apparel_size';
update _attr set options =
 '[{"value":"jacket","label":"Jacket"},{"value":"pants","label":"Pants"},{"value":"bibs","label":"Bibs"},
   {"value":"one_piece","label":"One-piece suit"},{"value":"base_layer","label":"Base layer"},
   {"value":"mid_layer","label":"Mid layer / fleece"},{"value":"vest","label":"Vest"}]'
 where key = 'garment';

insert into public.attribute_definitions
  (category_id, key, label, data_type, unit, options, min_value, max_value, step, is_required, is_size, sort_order)
select c.id, a.key, a.label, a.data_type, a.unit, a.options, a.min_value, a.max_value, a.step, a.is_required, a.is_size, a.sort_order
from _attr a join public.categories c on c.slug = a.cat;

insert into public.brands (slug, name, is_featured, sort_order) values
  ('rossignol', 'Rossignol', true, 10), ('salomon', 'Salomon', true, 20), ('atomic', 'Atomic', true, 30),
  ('nordica', 'Nordica', true, 40), ('blizzard', 'Blizzard', true, 50), ('head', 'Head', true, 60),
  ('volkl', 'Völkl', true, 70), ('k2', 'K2', true, 80), ('fischer', 'Fischer', true, 90),
  ('burton', 'Burton', true, 100),
  ('armada', 'Armada', false, 200), ('black-crows', 'Black Crows', false, 200), ('dynastar', 'Dynastar', false, 200),
  ('elan', 'Elan', false, 200), ('faction', 'Faction', false, 200), ('line', 'Line', false, 200),
  ('lange', 'Lange', false, 200), ('tecnica', 'Tecnica', false, 200), ('dalbello', 'Dalbello', false, 200),
  ('full-tilt', 'Full Tilt', false, 200), ('marker', 'Marker', false, 200), ('look', 'Look', false, 200),
  ('tyrolia', 'Tyrolia', false, 200), ('giro', 'Giro', false, 200), ('smith', 'Smith', false, 200),
  ('oakley', 'Oakley', false, 200), ('poc', 'POC', false, 200), ('anon', 'Anon', false, 200),
  ('lib-tech', 'Lib Tech', false, 200), ('gnu', 'GNU', false, 200), ('ride', 'Ride', false, 200),
  ('jones', 'Jones', false, 200), ('capita', 'CAPiTA', false, 200), ('never-summer', 'Never Summer', false, 200),
  ('union', 'Union', false, 200), ('thirtytwo', 'ThirtyTwo', false, 200), ('vans', 'Vans', false, 200),
  ('dc', 'DC', false, 200), ('the-north-face', 'The North Face', false, 200), ('patagonia', 'Patagonia', false, 200),
  ('spyder', 'Spyder', false, 200), ('helly-hansen', 'Helly Hansen', false, 200), ('obermeyer', 'Obermeyer', false, 200),
  ('arcteryx', 'Arc''teryx', false, 200), ('columbia', 'Columbia', false, 200), ('flylow', 'Flylow', false, 200),
  ('kjus', 'Kjus', false, 200), ('descente', 'Descente', false, 200), ('hestra', 'Hestra', false, 200),
  ('leki', 'Leki', false, 200), ('scott', 'Scott', false, 200), ('sweet-protection', 'Sweet Protection', false, 200);
drop table _attr;
