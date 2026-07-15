
CREATE TABLE IF NOT EXISTS public._altphone_plan (
  store_id uuid PRIMARY KEY,
  store_name text,
  primary_phone_keep text,
  secondary_phone_add text,
  formatted text,
  from_pass text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._altphone_plan TO service_role;
ALTER TABLE public._altphone_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only altphone plan" ON public._altphone_plan FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public._altphone_snap_stores (
  run_id uuid NOT NULL,
  store_id uuid NOT NULL,
  name text,
  phone text,
  alt_phone text,
  snapped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, store_id)
);
GRANT ALL ON public._altphone_snap_stores TO service_role;
ALTER TABLE public._altphone_snap_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only altphone snap" ON public._altphone_snap_stores FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public._altphone_plan (store_id, store_name, primary_phone_keep, secondary_phone_add, formatted, from_pass) VALUES
('52d3fdf5-4e39-4e53-982e-e717d77a9efc','Flatbush organic Corp','13473841796','9293699866','(929) 369-9866','pass1'),
('5ef4d400-7293-4f6c-ab6d-4d2ada13f25c','shaqs convenience','13478453268','5168059032','(516) 805-9032','pass1'),
('d30c3046-1499-46ee-9af3-0b4eaa4e2b90','the sandwich factory','19294767333','3478641694','(347) 864-1694','pass1'),
('35667c56-2cae-4d5f-a6b3-d84ab4b5b71e','big waves Grocery & deli','17187372391','3479863140','(347) 986-3140','pass1'),
('a5d0b312-aa38-4d11-968d-9d91f3ac4b17','Lucas deli and grocery','13473359399','3472795040','(347) 279-5040','pass1'),
('571147f5-1be4-4bf3-bad0-2ad11c07946f','Brooklyn. best Candy plus','17184609026','9296984170','(929) 698-4170','pass1'),
('37f91d2f-1cee-4b8f-9ed7-54ec01df8e92','Adam  convenience  and dadeli','13473126050','3478882656','(347) 888-2656','pass1'),
('2914151a-6015-4088-9f37-cdf6d8f364c5','Brooklyn deli','17188419395','9176487546','(917) 648-7546','pass1'),
('06a3f454-2682-445e-b04a-3738da004ba5','smoke shop','16318299117','9297368248','(929) 736-8248','pass1'),
('fda93832-bc52-40e4-9bca-5c8ebaa501ff','grab and go','13473503697','3476989960','(347) 698-9960','pass1'),
('c93e7709-6919-46f0-88fe-e563bc0680ff','mosaic smoke shop','13475593238','9293389867','(929) 338-9867','pass1'),
('c11abdc8-1cc2-4ff4-aee5-4a45f343e36c','Alex','13472407312','3475599714','(347) 559-9714','pass1'),
('97869a25-ecbf-4992-a93b-cd883d9e03f0','Loud pack','19292638888','3323313307','(332) 331-3307','pass1'),
('b4074f56-3874-4b78-b653-2b8506d8430c',NULL,'19293553727','9172468584','(917) 246-8584','pass2'),
('59213458-262b-4301-8943-1aadcec63534',NULL,'347 249 1240','9294257396','(929) 425-7396','pass2'),
('63af8fd3-73f5-4832-9fd2-3f206454504e',NULL,'17187730680','9296944111','(929) 694-4111','pass2'),
('8ec47f8c-ad3f-45c1-8d46-3384c2e9f91c',NULL,'16465520283','9179827064','(917) 982-7064','pass2'),
('8c0b8ebd-7da8-4124-8b8a-188720693383',NULL,'13476400591','3322735909','(332) 273-5909','pass2'),
('9a5b90f6-3bba-4ba4-8767-e910621e01cf',NULL,'16469194805','5168543685','(516) 854-3685','pass2'),
('2efadfdf-d466-49f4-859b-ea26325f3ebe',NULL,'16462283579','6466442073','(646) 644-2073','pass2'),
('148ad267-50a4-4243-9c5a-623abbe82f5a',NULL,'19293374171','9173859959','(917) 385-9959','pass2'),
('61d153b5-62d8-4ea8-a761-932eb613e1ce',NULL,'13478284439','9735831227','(973) 583-1227','pass2'),
('fbc1e075-4c85-4e1b-8ead-be69e76ba801',NULL,'13474810901','9296641137','(929) 664-1137','pass2'),
('9f37a9c3-6b11-44c5-b02a-d0527f6579d5',NULL,'13475718272','9295896132','(929) 589-6132','pass2'),
('2b57f104-f2ff-48aa-aab7-50a4bde5e4a3',NULL,'17184485410','6463616320','(646) 361-6320','pass3'),
('cc3b7661-5e38-4328-b133-7ffc431fc084',NULL,'9293564410','3472210343','(347) 221-0343','pass3')
ON CONFLICT (store_id) DO NOTHING;

INSERT INTO public._altphone_snap_stores (run_id, store_id, name, phone, alt_phone)
SELECT 'a17ec099-0000-4000-8000-000000000004'::uuid, s.id, s.name, s.phone, s.alt_phone
FROM public.stores s
JOIN public._altphone_plan p ON p.store_id = s.id
ON CONFLICT (run_id, store_id) DO NOTHING;
