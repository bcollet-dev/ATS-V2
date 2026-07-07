-- Add contract_break value to proposition_status enum
ALTER TYPE proposition_status ADD VALUE IF NOT EXISTS 'contract_break';
