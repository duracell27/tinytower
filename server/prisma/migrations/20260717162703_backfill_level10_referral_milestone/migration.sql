UPDATE "Referral" r
SET "level10ReachedAt" = now()
FROM "Player" p
WHERE p.id = r."referredId"
  AND p."playerLevel" >= 10
  AND r."level10ReachedAt" IS NULL;
