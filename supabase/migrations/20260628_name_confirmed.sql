ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name_confirmed boolean NOT NULL DEFAULT false;
