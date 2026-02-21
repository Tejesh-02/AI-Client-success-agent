-- Onboarding progress: steps completed per company (array of step keys).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_steps_done JSONB NOT NULL DEFAULT '[]'::jsonb;
