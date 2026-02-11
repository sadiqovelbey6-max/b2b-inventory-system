# MongoDB Setup və Hazırlıq

Bu sənəd sistemin MongoDB-yə uyğunlaşdırılması üçün hazırlıq addımlarını təsvir edir.

## ✅ Hazırlanmış Komponentlər

### 1. Paketlər
- ✅ `@nestjs/mongoose` - NestJS MongoDB modulu
- ✅ `mongoose` - MongoDB ODM
- ✅ `@types/mongoose` - TypeScript tipləri

### 2. Docker Konfiqurasiyası
- ✅ MongoDB servisi `docker-compose.yml`-də əlavə edilmişdir
- ✅ Port: `27017`
- ✅ Database: `b2b_inventory`
- ✅ Username: `b2b_user`
- ✅ Password: `b2b_pass`

### 3. Konfiqurasiya
- ✅ `mongodb.config.ts` - MongoDB connection konfiqurasiyası
- ✅ `configuration.ts` - MongoDB URI konfiqurasiyası
- ✅ `validation.ts` - Environment variable validasiyası

### 4. Schema-lar (Mongoose)
Aşağıdakı schema-lar hazırlanmışdır (hələ aktiv deyil):

- ✅ `ProductSchema` - `src/modules/products/schemas/product.schema.ts`
- ✅ `UserSchema` - `src/modules/users/schemas/user.schema.ts`
- ✅ `OrderSchema` - `src/modules/orders/schemas/order.schema.ts`
- ✅ `OrderItemSchema` - `src/modules/orders/schemas/order-item.schema.ts`

## 📋 Qalan İşlər (Migration zamanı)

### 1. Qalan Schema-lar
Aşağıdakı entity-lər üçün schema-lar yaradılmalıdır:
- Branch
- Inventory
- CartItem
- BranchCart
- Invoice
- Payment
- Transaction
- ManualAdjustment
- AuditLog
- Tenant
- ProductSubstitute
- RegistrationConfig

### 2. Module-lərdə Mongoose İnteqrasiyası
Hər bir module-də:
- Schema-nı import et
- `MongooseModule.forFeature([Schema])` əlavə et
- Service-də `@InjectModel()` istifadə et

### 3. Service-lərdə Query-lərin Çevrilməsi
- TypeORM Repository → Mongoose Model
- SQL queries → MongoDB queries
- Relations → References və ya Embedded documents

### 4. Migration Script
Migration script yaradılmalıdır:
- PostgreSQL-dən məlumatları export et
- Transform et (UUID → ObjectId, relations → references)
- MongoDB-yə import et

## 🚀 MongoDB-yə Keçid Addımları

### Addım 1: MongoDB-ni Aktiv Etmək
`app.module.ts`-də comment edilmiş MongooseModule-u aktiv et:

```typescript
MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return getMongoConfig();
  },
}),
```

### Addım 2: Schema-ları Aktiv Etmək
Hər bir module-də Mongoose schema-larını aktiv et.

### Addım 3: Service-ləri Yeniləmək
TypeORM repository-lərini Mongoose model-ləri ilə əvəz et.

### Addım 4: Migration Script İcra Etmək
PostgreSQL məlumatlarını MongoDB-yə köçür.

### Addım 5: Test Etmək
Bütün funksionallıqları test et və validasiya et.

## 📝 Qeydlər

- **Hazırkı vəziyyət**: Sistem PostgreSQL ilə işləyir
- **MongoDB hazırlığı**: Bütün struktur hazırdır, amma hələ aktiv deyil
- **Migration**: Migration script-i sonra yaradılacaq və icra olunacaq
- **Dual Support**: Sistem həm PostgreSQL, həm də MongoDB ilə işləyə bilər (keçid dövrü üçün)

## 🔧 Environment Variables

```env
# MongoDB (hazır, amma hələ istifadə olunmur)
MONGODB_URI=mongodb://localhost:27017/b2b_inventory

# PostgreSQL (hazırkı aktiv database)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=b2b_user
POSTGRES_PASSWORD=b2b_pass
POSTGRES_DB=b2b_inventory
```

## 📚 Əlavə Məlumat

Ətraflı plan üçün `MONGODB_MIGRATION_PLAN.md` faylına baxın.
