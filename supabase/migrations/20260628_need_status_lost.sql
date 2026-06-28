-- Add 'lost' value to need_status enum
ALTER TYPE need_status ADD VALUE IF NOT EXISTS 'lost';
