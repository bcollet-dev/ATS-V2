-- Stockage du refresh token Google OAuth par utilisateur
-- Utilisé pour l'envoi d'emails via Gmail API (scope gmail.send)
ALTER TABLE profiles ADD COLUMN google_refresh_token text;
