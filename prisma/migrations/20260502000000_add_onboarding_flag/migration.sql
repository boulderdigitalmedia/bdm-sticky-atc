-- Add onboarding completion flag to ShopSettings
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;