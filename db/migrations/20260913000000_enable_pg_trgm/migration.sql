-- Enable trigram similarity matching, used for fuzzy title search on the admin duplicates page
CREATE EXTENSION IF NOT EXISTS pg_trgm;
