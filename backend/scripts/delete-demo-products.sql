-- Demo/nümunə məhsullarını silmək üçün SQL script
-- Bu script seed service-də olan demo məhsulları silir
-- QEYD: Bu script yalnız demo məhsulları silir, istifadəçinin məhsullarına toxunmur

DO $$
DECLARE
    demo_code TEXT;
    product_id_to_delete UUID;
    deleted_count INTEGER := 0;
BEGIN
    -- Demo məhsul kodları (seed service-də olan)
    FOR demo_code IN 
        SELECT DISTINCT code 
        FROM products 
        WHERE code IN ('KOD100', 'KOD200', 'KOD300', 'KOD400')
    LOOP
        -- Hər demo kod üçün məhsulu tapırıq və silirik
        FOR product_id_to_delete IN
            SELECT id
            FROM products
            WHERE code = demo_code
        LOOP
            -- Əlaqəli məlumatları silirik
            DELETE FROM transactions WHERE product_id = product_id_to_delete;
            DELETE FROM order_items WHERE product_id = product_id_to_delete;
            DELETE FROM cart_items WHERE product_id = product_id_to_delete;
            DELETE FROM inventories WHERE product_id = product_id_to_delete;
            DELETE FROM product_substitutes WHERE product_id = product_id_to_delete OR substitute_id = product_id_to_delete;
            
            -- Məhsulu silirik
            DELETE FROM products WHERE id = product_id_to_delete;
            
            deleted_count := deleted_count + 1;
            RAISE NOTICE 'Silindi: məhsul id = %, kod = %', product_id_to_delete, demo_code;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Cəmi % demo məhsul silindi', deleted_count;
END $$;

-- Yoxlamaq
SELECT 
    code,
    COUNT(*) as count
FROM products
WHERE code IN ('KOD100', 'KOD200', 'KOD300', 'KOD400')
GROUP BY code;

-- Əgər nəticə boşdursa, deməli demo məhsullar silinib
