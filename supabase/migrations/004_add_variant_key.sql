-- Add variant_key column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS variant_key TEXT;
