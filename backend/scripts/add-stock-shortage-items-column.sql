-- Add stock_shortage_items column to orders table
-- This column stores JSONB data for stock shortage items when creating orders

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'stock_shortage_items'
    ) THEN
        -- Add the column
        ALTER TABLE orders 
        ADD COLUMN stock_shortage_items JSONB NULL;
        
        -- Add comment
        COMMENT ON COLUMN orders.stock_shortage_items IS 'Stores stock shortage items as JSONB array when order is created with insufficient stock';
        
        RAISE NOTICE 'Column stock_shortage_items added successfully';
    ELSE
        RAISE NOTICE 'Column stock_shortage_items already exists';
    END IF;
END $$;
