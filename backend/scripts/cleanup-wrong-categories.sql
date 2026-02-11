-- Yanlış kateqoriyaları təmizləmə scripti
-- Bu script database-dəki yanlış kateqoriyaları (məsələn "FILTERI", "Filterlə" və s.) silir

-- MÜHİM: Bu script-i icra etməzdən əvvəl backup edin!

-- Default kateqoriyalar (bu kateqoriyalar saxlanılacaq)
-- 'Yağ və mayelər', 'Filterlər', 'Asqı sistemi', 'Kuzov malları', 'Elektron malları', 'Mühərrik+Qutu'

-- Yanlış kateqoriyaları sil (default kateqoriyalardan başqa bütün kateqoriyaları NULL et)
UPDATE products 
SET category = NULL 
WHERE category IS NOT NULL 
  AND category NOT IN (
    'Yağ və mayelər',
    'Filterlər',
    'Asqı sistemi',
    'Kuzov malları',
    'Elektron malları',
    'Mühərrik+Qutu'
  );

-- Yoxlama: Qalan kateqoriyaları göstər
SELECT DISTINCT category 
FROM products 
WHERE category IS NOT NULL 
ORDER BY category;
