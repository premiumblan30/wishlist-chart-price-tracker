-- Pastikan price di price_history selalu positif
ALTER TABLE price_history
  ADD CONSTRAINT price_must_be_positive CHECK (price > 0);

-- Pastikan target_price di items selalu positif jika diisi
ALTER TABLE items
  ADD CONSTRAINT target_price_must_be_positive CHECK (target_price IS NULL OR target_price > 0);
