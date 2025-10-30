-- D1 Database Schema for Media Library AI Agent
-- This stores structured media metadata for fast SQL queries

-- Main media table
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,           -- Domain/hostname for multi-tenant
  hash TEXT NOT NULL,                -- Unique hash (url+page+alt+occurrence)
  url TEXT NOT NULL,                 -- Media URL (primary identifier)
  page_url TEXT NOT NULL,            -- Page where media appears
  
  -- Core attributes
  type TEXT,                         -- Media type: 'img > image', 'video > video', 'link > svg', etc.
  alt TEXT,                          -- Alt text (NULL = missing, '' = empty, 'text' = filled)
  width INTEGER,                     -- Width in pixels
  height INTEGER,                    -- Height in pixels
  orientation TEXT,                  -- 'landscape', 'portrait', 'square', or NULL
  category TEXT,                     -- AI category: 'logos', 'people-photos', 'graphics-ui', etc.
  
  -- Loading attributes
  loading TEXT,                      -- 'lazy', 'eager', or NULL
  fetchpriority TEXT,                -- 'high', 'low', 'auto', or NULL
  is_lazy_loaded BOOLEAN DEFAULT 0,  -- Derived from data-src attributes
  
  -- Accessibility
  role TEXT,                         -- ARIA role
  aria_hidden BOOLEAN DEFAULT 0,     -- aria-hidden="true"
  
  -- Context
  parent_tag TEXT,                   -- Parent element (figure, picture, etc)
  has_figcaption BOOLEAN DEFAULT 0,  -- Has figcaption sibling
  
  -- Timestamps
  indexed_at INTEGER NOT NULL,       -- When indexed for AI
  
  -- Indexes for fast queries
  UNIQUE(site_key, hash)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_media_site_key ON media(site_key);
CREATE INDEX IF NOT EXISTS idx_media_url ON media(url);
CREATE INDEX IF NOT EXISTS idx_media_page_url ON media(page_url);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_alt_null ON media(alt) WHERE alt IS NULL OR alt = '';
CREATE INDEX IF NOT EXISTS idx_media_orientation ON media(orientation);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_loading ON media(loading);
CREATE INDEX IF NOT EXISTS idx_media_lazy ON media(is_lazy_loaded) WHERE is_lazy_loaded = 1;
CREATE INDEX IF NOT EXISTS idx_media_size ON media(width, height);

