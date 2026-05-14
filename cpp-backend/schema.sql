-- Enums
CREATE TYPE user_type_enum AS ENUM ('FARMER', 'WHOLESALER', 'TRANSPORTER', 'ADMIN');
CREATE TYPE listing_status_enum AS ENUM ('Available', 'Reserved', 'Sold');
CREATE TYPE order_status_enum AS ENUM ('Pending', 'Accepted', 'Rejected', 'Completed');
CREATE TYPE transport_status_enum AS ENUM ('Pending', 'In_Transit', 'Delivered', 'Cancelled');

-- Users (with roles)
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    type          user_type_enum NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Listings
CREATE TABLE listings (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_name       VARCHAR(255) NOT NULL,
    total_quantity  DOUBLE PRECISION NOT NULL,         -- original stock e.g. 500kg
    available_qty   DOUBLE PRECISION NOT NULL,         -- decreases as orders come in
    min_order_qty   DOUBLE PRECISION DEFAULT 1,        -- minimum a wholesaler can order
    price           DOUBLE PRECISION NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    status          listing_status_enum DEFAULT 'Available',
    created_at      TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_available_lte_total   CHECK (available_qty <= total_quantity),
    CONSTRAINT chk_available_positive    CHECK (available_qty >= 0),
    CONSTRAINT chk_min_order_positive    CHECK (min_order_qty > 0),
    CONSTRAINT chk_price_positive        CHECK (price > 0),
    CONSTRAINT chk_total_qty_positive    CHECK (total_quantity > 0),
    CONSTRAINT chk_min_lte_total         CHECK (min_order_qty <= total_quantity)
);

-- Orders (wholesaler buys a portion of a listing)
CREATE TABLE orders (
    id               SERIAL PRIMARY KEY,
    listing_id       INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    wholesaler_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    quantity_ordered DOUBLE PRECISION NOT NULL,
    total_price      DOUBLE PRECISION NOT NULL,        -- quantity_ordered * price at time of order
    status           order_status_enum DEFAULT 'Pending',
    created_at       TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_order_qty_positive CHECK (quantity_ordered > 0),
    CONSTRAINT chk_total_price_positive CHECK (total_price > 0)
);

-- Transport Jobs
CREATE TABLE transport_jobs (
    id              SERIAL PRIMARY KEY,
    listing_id      INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,  -- optionally tied to an order
    requested_by    INTEGER NOT NULL REFERENCES users(id),             -- farmer or wholesaler
    pickup_location VARCHAR(255) NOT NULL,
    destination     VARCHAR(255) NOT NULL,
    cargo_desc      TEXT,
    transport_date  DATE,
    status          transport_status_enum DEFAULT 'Pending',
    is_assigned     BOOLEAN DEFAULT FALSE,
    transporter_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Crop Analyses
CREATE TABLE crop_analyses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_path  VARCHAR(500) NOT NULL,
    result      VARCHAR(100) NOT NULL,
    confidence  FLOAT NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Education Articles
CREATE TABLE education_articles (
    id         SERIAL PRIMARY KEY,
    author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- Admin who wrote it
    title      VARCHAR(255) NOT NULL,
    content    TEXT NOT NULL,
    category   VARCHAR(100),   -- 'Soil', 'Pest Control', 'Irrigation', 'Post-Harvest'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_listings_status    ON listings(status);
CREATE INDEX idx_listings_crop      ON listings(crop_name);
CREATE INDEX idx_listings_location  ON listings(pickup_location);
CREATE INDEX idx_listings_user      ON listings(user_id);
CREATE INDEX idx_orders_listing     ON orders(listing_id);
CREATE INDEX idx_orders_wholesaler  ON orders(wholesaler_id);
CREATE INDEX idx_transport_assigned ON transport_jobs(is_assigned);
CREATE INDEX idx_transport_status   ON transport_jobs(status);
CREATE INDEX idx_analyses_user      ON crop_analyses(user_id);

-- Add category enum
CREATE TYPE category_enum AS ENUM (
    'Fruits', 'Vegetables', 'Grains', 'Legumes', 
    'Tubers', 'Spices', 'Dairy', 'Other'
);

-- Add category and image_url to listings
ALTER TABLE listings 
    ADD COLUMN category category_enum DEFAULT 'Other',
    ADD COLUMN image_url VARCHAR(500),
    ADD COLUMN description TEXT,
    ADD COLUMN region VARCHAR(255);

ALTER TABLE orders RENAME COLUMN wholesaler_id TO buyer_id;

ALTER TYPE order_status_enum ADD VALUE 'Cancelled';