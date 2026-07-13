-- OB1 : ne « brûler » l'invitation que si un profil est réellement créé.
-- Avant, l'invitation était consommée même en cas de conflit (profil existant),
-- ce qui perdait l'invitation lors d'un re-onboarding. La réactivation d'un
-- utilisateur existant se gère désormais dans l'app (settings/users).
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

  -- 4. Ne consommer l'invitation que si un profil a réellement été créé.
  IF FOUND THEN
    UPDATE allowed_emails
    SET consumed_at = now()
    WHERE email = new.email;
  END IF;

  RETURN new;
END;
$$;
