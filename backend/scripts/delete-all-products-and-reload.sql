-- MÜHİM: Bu script BÜTÜN məhsulları silir və əlaqəli məlumatları təmizləyir
-- İstifadə etməzdən əvvəl backup alın!

-- Əlaqəli cədvəllərdən məlumatları sil
DELETE FROM cart_items;
DELETE FROM order_items;
DELETE FROM inventories;
DELETE FROM transactions;
DELETE FROM manual_adjustments_log;
DELETE FROM product_substitutes;

-- Bütün məhsulları sil
DELETE FROM products;

-- Nəticəni göstər
SELECT COUNT(*) as remaining_products FROM products;
SELECT COUNT(*) as remaining_inventories FROM inventories;
SELECT COUNT(*) as remaining_cart_items FROM cart_items;
SELECT COUNT(*) as remaining_order_items FROM order_items;

-- QEYD: Bu script işlədikdən sonra:
-- 1. Seed service SÖNDÜRÜLÜB (RUN_SEED=false), demo məhsullar YARADILMAYACAQ
-- 2. Synchronize SÖNDÜRÜLÜB (DB_SYNCHRONIZE=false), məlumatlar SİLİNMEYƏCƏK
-- 3. Məhsulları yenidən yükləmək üçün admin panelindən toplu import istifadə edin
