-- Enable pgcrypto for secure token generation (gen_random_bytes, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;