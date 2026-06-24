-- ============================================================
-- UNIQUE email sur profiles (nécessaire pour ON CONFLICT)
-- ============================================================
ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- ============================================================
-- Table allowed_emails — référentiel des invitations
-- ============================================================
CREATE TABLE allowed_emails (
  email        text PRIMARY KEY,
  role         app_role DEFAULT 'admissions' NOT NULL,
  invited_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  consumed_at  timestamptz,
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- RLS allowed_emails — admin uniquement pour tout
-- ============================================================
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_emails_select" ON allowed_emails
  FOR SELECT TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "allowed_emails_insert" ON allowed_emails
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "allowed_emails_update" ON allowed_emails
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "allowed_emails_delete" ON allowed_emails
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');

-- ============================================================
-- Pré-autorisation admin (bootstrap — pas d'invited_by)
-- ============================================================
INSERT INTO allowed_emails (email, role)
VALUES ('bcollet@eda-rh.fr', 'admin');

-- ============================================================
-- handle_new_user — mise à jour avec contrôles domaine + invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authorized_role app_role;
BEGIN
  -- 1. Restriction domaine @eda-rh.fr
  IF new.email NOT LIKE '%@eda-rh.fr' THEN
    RAISE EXCEPTION 'Unauthorized email domain: %', new.email;
  END IF;

  -- 2. Vérification invitation (existence + non consommée)
  SELECT role INTO authorized_role
  FROM allowed_emails
  WHERE email = new.email AND consumed_at IS NULL;

  IF authorized_role IS NULL THEN
    RAISE EXCEPTION 'Email not authorized or invitation already used: %', new.email;
  END IF;

  -- 3. Création du profil avec le rôle de l'invitation
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    authorized_role
  )
  ON CONFLICT (email) DO NOTHING;

  -- 4. Marquer l'invitation comme consommée
  UPDATE allowed_emails
  SET consumed_at = now()
  WHERE email = new.email;

  RETURN new;
END;
$$;
