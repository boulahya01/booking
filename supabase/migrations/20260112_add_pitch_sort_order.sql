-- Add sort_order column to pitches table
ALTER TABLE public.pitches ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Set initial sort order based on creation date (in order of when pitches were created)
WITH ranked_pitches AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.pitches
)
UPDATE public.pitches p
SET sort_order = rp.rn
FROM ranked_pitches rp
WHERE p.id = rp.id;

-- Create index for better query performance
CREATE INDEX idx_pitches_sort_order ON public.pitches(sort_order);
