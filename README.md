## Solob2b.az B2B Inventar Sistemi

Filial əsaslı inventar və sifariş idarəetmə platforması. Layihə aşağıdakı komponentlərdən ibarətdir:

- `frontend/` – React + TypeScript + Vite + Tailwind UI
- `backend/` – NestJS + TypeORM + PostgreSQL + Redis
- `docker-compose.yml` – Postgres, Redis, MongoDB, backend və frontend konteynerləri

### Funksional siyahı (v1.1 demo)

- JWT əsaslı giriş/Qeydiyyat (demo istifadəçi: `admin@demo.az / Admin123!`)
- Filiallara görə stok cədvəli, səbət və sifariş idarəçiliyi
- Kod axtarışı: eyni kodla bağlı bütün məhsullar, stok 0 olsa belə göstərilir
- Sifariş axını: səbətdən təsdiqə, PDF qaimə generasiyası, manual ödəniş qeydi
- Admin paneli: istifadəçi/filial idarəsi, qeydiyyat limiti konfiqurasiyası
- Məhsul idarəetməsi: toplu məhsul əlavə etmə, birdən çox məhsul silmə (bulk delete), kateqoriya idarəetməsi
- Import/Export mərkəzi: məhsul/inventar CSV yükü, sifariş/qaimə/ödəniş exportu
- Audit logları: bütün dəyişikliklərin izlənməsi, filtr, səhifələmə və sahə-sahə diff vizuallaşdırması
- Storage xidməti: lokal `uploads/` və ya S3-compatible obyekt deposu ilə fayl saxlanması
  - Fayl ölçüsü/type doğrulaması və avtomatik şəkil thumbnail-ləri (`STORAGE_IMAGE_SIZES`)
- İki faktorlu autentifikasiya və SMTP əsaslı e-poçt bildiriş infrastrukturu
- Swagger sənədi `http://localhost:4000/api/docs`
- MongoDB hazırlığı: sistem MongoDB-yə migration üçün hazırlanmışdır (schema-lar və konfiqurasiya hazırdır, migration hələ edilməyib)

### Çalışdırma

1. Reponu klonlayın və kök qovluğa keçin.

2. Mühit fayllarını köçürün:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Lazım olan dəyişiklikləri edin (`CORS_ORIGINS`, `S3` parametr və s.).

3. Docker ilə başlatmaq:
   ```bash
   docker-compose up --build
   ```
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:4000/api
   - Swagger: http://localhost:4000/api/docs
   - Sağlamlıq detayı: http://localhost:4000/api/health/details
   - Monitorinq: http://localhost:4000/api/metrics
   - Sağlamlıq testi: `curl http://localhost:4000/api/health`
   - Demo giriş: 
     ```bash
     curl -X POST http://localhost:4000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"admin@demo.az","password":"Admin123!"}'
     ```

4. Real API test mühiti:
   ```bash
   docker compose -f docker-compose.test.yml up -d
   # backend/env.test.sample faylını .env.test kimi kopyalayın və ehtiyac olduqda yeniləyin
   cd backend
   POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 \
   REDIS_HOST=127.0.0.1 REDIS_PORT=6380 \
   JWT_ACCESS_SECRET=test-access-secret \
   JWT_REFRESH_SECRET=test-refresh-secret \
   npm run test:e2e -- --runInBand
   docker compose -f ../docker-compose.test.yml down -v
   ```

5. Lokal inkişaf (opsional):
   ```bash
   # Backend
   cd backend
   npm install
   npm run start:dev # varsayılan port 4000

   # Frontend
   cd ../frontend
   npm install
   npm run dev -- --host --port 4200
   ```

### Demo Axınlar və Məlumatlar

- İstifadəçi: `admin@demo.az / Admin123!`
- Demo CSV faylları: `docs/examples/products.csv`, `docs/examples/inventory.csv`
- Postman kolleksiyası: `docs/postman/b2b-inventory-collection.json`
- Endpoint-lər: `/api/health/details`, `/api/metrics`, `/api/docs`

- 3 filial (`Bakı`, `Gəncə`, `Sumqayıt`)
- 5 demo məhsul, stok və tranzit miqdarları

### Layihə Strukturu

- Backend modulları: `auth`, `users`, `branches`, `products`, `inventory`, `carts`, `orders`, `invoices`, `payments`, `audit`, `notifications`, `seed`
- Entity-lər: `User`, `Branch`, `Product`, `Inventory`, `BranchCart`, `CartItem`, `Order`, `OrderItem`, `Invoice`, `Payment`, `AuditLog`, `RegistrationConfig`
- Frontend səhifələri: Dashboard, Məhsullar, Kod Axtarışı, Səbət, Sifarişlər, Qaimələr, Ödənişlər, Import/Export, Audit Logları, Admin

### Test və Keyfiyyət

| Sahə | Skript | Qeyd |
| --- | --- | --- |
| Backend lint | `npm run lint` (backend) | ESLint |
| Backend unit | `npm run test` (backend) | Jest |
| Backend e2e | `npm run test:e2e` (backend) | Jest + Supertest |
| Frontend lint | `npm run lint` (frontend) | ESLint |
| Frontend test | `npm run test` (frontend) | Vitest + Testing Library |
| Frontend build | `npm run build` (frontend) | Vite/TypeScript |
| Frontend e2e | `npm run cy:run` (frontend) | Cypress |

GitHub Actions üçün `CI` workflow (lint + build + test) təmin edilib. Localda `npm run test:watch`, `npm run test:coverage` (frontend) istifadə oluna bilər.

### Tövsiyə olunan növbəti addımlar

- 2FA aktivləşdirmə, e-mail bildiriş servisi və WebSocket real-time xəbərdarlıqları
- CSV/Excel import/export axınının biznes qaydaları və doğrulama məntiqi
- Audit log API-sinin diff vizualizasiyasının genişləndirilməsi və əlavə filtrlər
- StorageService üzərindən media idarəsinin (thumbnail, lifecycle) dərinləşdirilməsi
- Alt-sistemlər üçün tam ssenarili Cypress end-to-end testlər
