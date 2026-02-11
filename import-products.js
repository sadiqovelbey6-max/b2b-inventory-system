const fs = require('fs');
const path = require('path');

// Məhsulları import etmək üçün text faylı oxu
const importText = fs.readFileSync(path.join(__dirname, 'products-import.txt'), 'utf-8');

console.log('Məhsul import text:');
console.log(importText);
console.log('\n---\n');
console.log('Bu text-i admin panelində bulk import bölməsində istifadə edin.');
console.log('Əvvəlcə "Bütün məhsulları sil" düyməsini basın, sonra bu text-i bulk import bölməsinə yapışdırın.');

