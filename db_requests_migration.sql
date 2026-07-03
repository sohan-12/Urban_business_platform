-- Create business_requests table
CREATE TABLE IF NOT EXISTS business_requests (
    id SERIAL PRIMARY KEY,
    shopkeeper_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    price_range VARCHAR(10) DEFAULT '$$',
    latitude NUMERIC(10,8) DEFAULT 0,
    longitude NUMERIC(11,8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    items_json TEXT NOT NULL, -- JSON array of items: [{"name": "...", "description": "...", "price": 10.00}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
