-- Məhsul kodunun unique olmasını təmin etmək üçün SQL script
-- Bu script təhlükəsiz şəkildə təkrarlanan məhsulları təmizləyir və unique constraint əlavə edir

-- 1. Təkrarlanan məhsulları tapmaq və köhnələrini silmək
-- Hər kod üçün ən köhnə məhsulu saxlayırıq, digərlərini silirik

DO $$
DECLARE
    duplicate_code TEXT;
    product_id_to_keep UUID;
    product_id_to_delete UUID;
BEGIN
    -- Təkrarlanan kodları tapırıq
    FOR duplicate_code IN 
        SELECT code 
        FROM products 
        GROUP BY code 
        HAVING COUNT(*) > 1
    LOOP
        -- Hər kod üçün ən köhnə məhsulu saxlayırıq (created_at ən kiçik olan)
        SELECT id INTO product_id_to_keep
        FROM products
        WHERE code = duplicate_code
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- Digər məhsulları silirik (əlaqəli məlumatları da)
        FOR product_id_to_delete IN
            SELECT id
            FROM products
            WHERE code = duplicate_code
            AND id != product_id_to_keep
        LOOP
            -- Əlaqəli məlumatları silirik (CASCADE ilə avtomatik silinəcək, amma əmin olmaq üçün manual silirik)
            -- Foreign key constraint-lər CASCADE ilə silinəcək, amma əmin olmaq üçün əvvəlcə child record-ları silirik
            DELETE FROM transactions WHERE product_id = product_id_to_delete;
            DELETE FROM order_items WHERE product_id = product_id_to_delete;
            DELETE FROM cart_items WHERE product_id = product_id_to_delete;
            DELETE FROM inventories WHERE product_id = product_id_to_delete;
            DELETE FROM product_substitutes WHERE product_id = product_id_to_delete OR substitute_id = product_id_to_delete;
            
            -- Məhsulu silirik
            DELETE FROM products WHERE id = product_id_to_delete;
            
            RAISE NOTICE 'Silindi: məhsul id = %, kod = %', product_id_to_delete, duplicate_code;
        END LOOP;
        
        RAISE NOTICE 'Saxlanıldı: məhsul id = %, kod = %', product_id_to_keep, duplicate_code;
    END LOOP;
END $$;

-- 2. Unique constraint əlavə etmək
-- Əgər constraint artıq varsa, xəta verməyəcək (IF NOT EXISTS PostgreSQL-də dəstəklənmir, ona görə də try-catch istifadə edirik)

DO $$
BEGIN
    -- Əvvəlcə mövcud constraint-i silməyə çalışırıq (əgər varsa)
    BEGIN
        ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;
        RAISE NOTICE 'Köhnə constraint silindi (əgər varsa)';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Köhnə constraint yoxdur';
    END;
    
    -- Yeni unique constraint əlavə edirik
    ALTER TABLE products ADD CONSTRAINT products_code_key UNIQUE (code);
    RAISE NOTICE 'Unique constraint uğurla əlavə edildi';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Constraint artıq mövcuddur';
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Xəta: %', SQLERRM;
END $$;

-- 3. Yoxlamaq
SELECT 
    code,
    COUNT(*) as count
FROM products
GROUP BY code
HAVING COUNT(*) > 1;

-- Əgər nəticə boşdursa, deməli hər kod unikaldır
