-- Fix wood and cement default values from 0 to 1 to match other tools (briks, glass, nails, screw)
ALTER TABLE "PlayerState" ALTER COLUMN "wood" SET DEFAULT 1;
ALTER TABLE "PlayerState" ALTER COLUMN "cement" SET DEFAULT 1;
