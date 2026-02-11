## Backend – Solob2b.az Inventar API

Filial əsaslı inventar və sifariş idarəetmə API-si NestJS ilə qurulub. Modul strukturu:

- Autentifikasiya: `auth`, `users`
- Məlumat kataloqu: `branches`, `products`, `inventory`
- Sifariş axını: `carts`, `orders`, `invoices`, `payments`
- Audit və bildiriş: `audit`, `notifications`
- Demo seed modul: `seed`

### Mühit dəyişənləri

`backend/.env` faylında ən azı aşağıdakı dəyərlər olmalıdır:

```
PORT=4000
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=b2b_user
POSTGRES_PASSWORD=b2b_pass
POSTGRES_DB=b2b_inventory

JWT_ACCESS_SECRET=<random-32-char-access-secret>
JWT_REFRESH_SECRET=<random-32-char-refresh-secret>

CORS_ORIGINS=http://localhost:5173

# S3 inteqrasiyası üçün (opsional)
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ENDPOINT=https://fra1.digitaloceanspaces.com  # opsional, S3-compatible servis üçün
S3_ACCESS_KEY=example
S3_SECRET_KEY=example
S3_PUBLIC_URL=https://cdn.example.com           # opsional, public CDN
STORAGE_MAX_FILE_SIZE=10485760                  # 10 MB
STORAGE_ALLOWED_MIME=image/png,image/jpeg,application/pdf
STORAGE_IMAGE_SIZES=320x320,640x640

# SMTP (email bildirişləri üçün)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=demo
SMTP_PASSWORD=demo
SMTP_FROM="B2B Inventory <no-reply@b2b.local>"

# 2FA konfiqurasiyası
TWO_FACTOR_ISSUER=B2B Inventory
```

`backend/.env.example` bütün parametrlərin nümunəsini ehtiva edir.

### Skriptlər

```bash
npm install         # asılılıqlar
npm run start:dev   # http://localhost:4000/api, swagger: /api/docs
npm run lint        # ESLint
npm run build       # Nest build (dist/)
npm run test        # Jest unit testləri
npm run test:e2e    # Jest + Supertest e2e
npm run test:cov    # Coverage
```

### Docker

`docker-compose.yml` backend konteynerini 4000 portu ilə ayağa qaldırır və Postgres/Redis asılılıqlarını təmin edir. Addımlar:

1.  Mühit faylını hazırlayın (demo dəyərlər sonradan dəyişdirilə bilər):
    ```bash
    cp backend/.env.example backend/.env
    ```
    `.env` daxilində `POSTGRES_HOST=postgres` və `REDIS_HOST=redis` olduğuna əmin olun.

2.  Docker servislərini işə salın:
    ```bash
    docker compose up --build backend
    ```
    Bütün stack üçün (frontend daxil): `docker compose up --build`.

3.  Sağlamlıq yoxlaması:
    ```bash
    curl http://localhost:4000/api/health
    curl http://localhost:4000/api/docs  # Swagger
    ```

4.  Demo giriş ssenarisi:
    ```bash
    curl -X POST http://localhost:4000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@demo.az","password":"Admin123!"}'
    ```
    Cavab JWT access/refresh token qaytaracaq. Bu istifadəçidə 2FA deaktivdir, ancaq `auth` modulundan aktiv edilə bilər.

`SeedModule` tətbiq startında avtomatik demo filial/məhsul və `admin@demo.az / Admin123!` istifadəçisini yaradır. Mövcud istifadəçi olduqda seed skip edilir.

### Test mühiti (real API)

Jest e2e və inteqrasiya sınaqları üçün Postgres/Redis servislerini ayağa qaldırmaq üçün kök qovluqdakı `docker-compose.test.yml` faylından istifadə edin:

```bash
# Servisləri işə sal
docker compose -f docker-compose.test.yml up -d

# Ayrı terminalda backend kataloquna keç və test env faylı hazırla
cp env.test.sample .env.test
# Lazım olan dəyərləri dəyişdir

# E2E testlərini işə sal
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6380 \
JWT_ACCESS_SECRET=test-access-secret \
JWT_REFRESH_SECRET=test-refresh-secret \
npm run test:e2e -- --runInBand

# İş bitdikdən sonra servisləri söndür
docker compose -f docker-compose.test.yml down -v
```

GitHub Actions workflow-u (`.github/workflows/ci.yml`) həmin test docker-compose faylını işə salır, hazır olduqdan sonra backend e2e skriptini icra edir və nəticədə qabaqcadan toxumlanmış real Postgres/Redis mühiti üzərində testlər təmin edilir.

- `GET /api/health/details` Postgres, Redis və yaddaş indikatorlarını əhatə edən Terminus nəticələrini qaytarır.
- `GET /api/metrics` uptime, yaddaş istifadəsi və CPU yükü kimi əsas göstəriciləri JSON formatında təqdim edir.

Frontend performans izləməsi üçün `npm run analyze` (bundle report) və `npm run lighthouse` alətləri mövcuddur; CI pipeline Lighthouse hesabatını artefakt kimi saxlayır.

### StorageService

- `storage.driver=local` olduqda fayllar `uploads/` (və ya `STORAGE_DRIVER=local`) altında saxlanılır.
- `storage.driver=s3` olduqda AWS S3 və ya S3-compatible servislərə qoşulmaq üçün `S3_*` dəyişənləri istifadə olunur.
- `StorageService.upload()` `key` və `url` qaytarır; S3 üçün `public-read` olduğu halda `S3_PUBLIC_URL` ilə CDN linki yaradıla bilər.
- Fayl doğrulaması (`maxFileSize`, `allowedMimeTypes`) və avtomatik image thumbnail generasiyası (`STORAGE_IMAGE_SIZES`) dəstəklənir.
- `upload` cavabı `thumbnails` massivini (key + url) qaytararaq UI üçün hazır preview linkləri təqdim edir.

### Auth və 2FA

- `POST /auth/2fa/setup`: JWT ilə qorunan endpoint, yeni secret və QR-code data URL qaytarır.
- `POST /auth/2fa/enable`: istifadəçi daxil etdiyi kodu təsdiqləyir və 2FA-nı aktiv edir.
- `POST /auth/2fa/disable`: 2FA deaktiv edilir və secret təmizlənir.
- `login` endpoint-i iki faktorlu giriş aktiv olan istifadəçilərdən `twoFactorCode` tələb edir.
- E-poçt bildirişləri `NotificationsService` vasitəsilə SMTP ilə göndərilir; SMTP konfiqurasiyası tamamlanmayıbsa loglara yazılır.
- `EventEmitterModule` vasitəsilə sistem hadisələri (`order.created` və s.) emit olunaraq bildiriş servisinə ötürülür.

### Audit API

- `GET /admin/audit`: `page`, `pageSize`, `userId`, `entity`, `entityId`, `action`, `from`, `to`, `search` filtrləri dəstəklənir.
- Cavab: `{ data: AuditLogDto[], meta: { page, pageSize, total, totalPages, hasMore } }`.
- Hər log üçün `changes[]` massivində `path`, `type (added|removed|modified)`, `before`, `after` diff məlumatları mövcuddur.
- `GET /admin/audit/entities`, `GET /admin/audit/actions` referens siyahıları qaytarır.

### Import / Export formatları

- **Məhsul CSV** (`/admin/import/products`):
  - Sətirlər: `code`, `name`, `description`, `category`, `price`, `unit`, `barcode`, `imageUrl`
  - Mövcud məhsullar kod üzrə yenilənir, yeni kodlar yaradılır.
  - `code` və `name` məcburidir, `price` mənfi və ya qeyri-rəqəm ola bilməz.
- **İnventar CSV** (`/admin/import/inventory`):
  - Sətirlər: `branch_code`, `product_code`, `available_qty`, `in_transit_qty`, `reserved_qty`
  - Filial və məhsul kodları üzrə inventar qeydləri yaradılır/yaxud yenilənir.
  - Say sahələri tam ədəd və 0-dan böyük olmalıdır.
- **Export** (`/admin/export/{orders|invoices|payments}.{csv|pdf}`):
  - CSV faylları başlıq + məlumat sətirləri ilə generasiya olunur.
  - PDF faylı eyni məlumatı sadə cədvəl formatında təqdim edir.

### Swagger

`SwaggerModule` `http://localhost:4000/api/docs` ünvanında aktivdir. Endpoint-lər `auth`, `products`, `orders`, `admin`, `audit` kimi tag-lar üzrə qruplaşdırılıb və `@ApiOperation` annotasiyaları ilə təsvir olunub.

### Demo seed məlumatları

- 3 filial (`Bakı`, `Gəncə`, `Sumqayıt`)
- 5 demo məhsul (+ inventar miqdarları)
- Super admin hesabı: `admin@demo.az / Admin123!`

`seed` moduluna ehtiyac qalmasa `SeedService`-i `AppModule`-dan çıxarmaq kifayətdir.
