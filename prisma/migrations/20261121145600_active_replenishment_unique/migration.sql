CREATE UNIQUE INDEX "ReplenishmentRequest_one_active_per_location"
ON "ReplenishmentRequest" ("materialId", "locationId")
WHERE "status" IN ('NEEDED', 'REQUESTED', 'IN_SUPPLY');
