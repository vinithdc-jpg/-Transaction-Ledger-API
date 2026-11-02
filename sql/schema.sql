CREATE TABLE IF NOT EXISTS public.accounts (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL CHECK (btrim(name) <> ''),
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <> 'NaN'::numeric),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id VARCHAR PRIMARY KEY,
  account_id VARCHAR NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  type VARCHAR NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR NOT NULL CHECK (btrim(reference_id) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_account_reference UNIQUE (account_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_created
  ON public.transactions (account_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR NOT NULL UNIQUE CHECK (btrim(staff_id) <> ''),
  name VARCHAR NOT NULL CHECK (btrim(name) <> ''),
  email VARCHAR NOT NULL CHECK (btrim(email) <> ''),
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email_lower_unique
  ON public.staff (lower(email));

CREATE TABLE IF NOT EXISTS public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL CHECK (btrim(email) <> ''),
  key_hash VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invites_active_email_unique
  ON public.staff_invites (lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;
