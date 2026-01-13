-- Set pitch sort order based on display preference
-- 1 = Football (الحي), 2 = Basketball 1, 3 = Basketball 2, 4 = Football (الكلية)

UPDATE public.pitches SET sort_order = 1 WHERE id = '03cd1b68-0b74-488d-a90a-6d6c64b8ab5c'; -- Football (الحي)
UPDATE public.pitches SET sort_order = 3 WHERE id = '1b1bcd12-7a13-4d42-8eed-01ecf982b165'; -- Basketball 2
UPDATE public.pitches SET sort_order = 4 WHERE id = '650dbffc-ea08-43dc-89ed-e2549359a49f'; -- Football (الكلية)
UPDATE public.pitches SET sort_order = 2 WHERE id = 'e8875136-5776-484d-b51b-15e91f9254ed'; -- Basketball 1

-- Verify the updates
SELECT id, name, sort_order FROM public.pitches ORDER BY sort_order;
