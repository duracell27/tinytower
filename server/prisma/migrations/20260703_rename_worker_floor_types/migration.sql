-- Rename Worker floorType values to match renamed config keys
-- Order matters: rename blue→red first to avoid collision with teal→blue
UPDATE "Worker" SET "floorType" = 'red'    WHERE "floorType" = 'blue';
UPDATE "Worker" SET "floorType" = 'blue'   WHERE "floorType" = 'teal';
UPDATE "Worker" SET "floorType" = 'yellow' WHERE "floorType" = 'amber';
UPDATE "Worker" SET "floorType" = 'violet' WHERE "floorType" = 'purple';
