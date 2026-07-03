-- Alter users table to add shopkeeper details columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS shop_address TEXT,
ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS license_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS business_phone VARCHAR(20);
