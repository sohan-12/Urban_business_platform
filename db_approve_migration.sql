-- Add status and shop_category columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS shop_category VARCHAR(100);

-- Make sure existing users are marked as approved
UPDATE users SET status = 'approved' WHERE status IS NULL;
