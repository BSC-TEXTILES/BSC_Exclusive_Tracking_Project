-- Admittance codes table for location-based access control
-- Each user gets a unique admittance code assigned to a specific location

CREATE TABLE IF NOT EXISTS admittance_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  admittance_code VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_admittance_codes_user ON admittance_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_admittance_codes_code ON admittance_codes(admittance_code);

-- Add comment
COMMENT ON TABLE admittance_codes IS 'Admittance codes assigned to users for location-based access during GPS tracking';
