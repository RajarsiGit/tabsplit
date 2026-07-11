-- Grants for the app's runtime role (tabsplit) on objects owned by the database's
-- default owner role (neondb_owner). Run this once in the Neon Console's SQL Editor
-- (which connects as the owner role) - NOT via the app's own DATABASE_URL connection,
-- since GRANT requires ownership/admin rights on the objects being granted.
--
-- Safe to re-run. See "Neon role/ownership gotcha" in CLAUDE.md for why this is needed:
-- a non-owner role can create new objects (and owns what it creates), but has no
-- access at all to objects owned by the default owner role unless explicitly granted.

GRANT USAGE ON SCHEMA public TO tabsplit;

-- Existing tables and views
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tabsplit;

-- Existing sequences (needed for SERIAL/nextval() on INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tabsplit;

-- Existing functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO tabsplit;

-- Make the same grants automatic for anything the owner role creates from here on
-- (e.g. running schema.sql itself from the Neon Console instead of via tabsplit)
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tabsplit;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tabsplit;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO tabsplit;
