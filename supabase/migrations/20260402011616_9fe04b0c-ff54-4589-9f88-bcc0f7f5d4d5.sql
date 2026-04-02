ALTER TABLE public.dc_phone_numbers 
ADD CONSTRAINT dc_phone_numbers_phone_number_key 
UNIQUE (phone_number);