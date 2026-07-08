-- Rename enum value contract_break → rupture in both enums
ALTER TYPE candidate_status RENAME VALUE 'contract_break' TO 'rupture';
ALTER TYPE proposition_status RENAME VALUE 'contract_break' TO 'rupture';
