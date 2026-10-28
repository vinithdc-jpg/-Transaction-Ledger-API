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
