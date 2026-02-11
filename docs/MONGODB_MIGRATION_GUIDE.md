# MongoDB-yə Keçid Təlimatı

Sistem MongoDB üçün hazırlanmışdır. Aşağıda hazır komponentlər və migration addımları təsvir olunur.

## ✅ Konvertasiya Statusu (Son yeniləmə)

- **app.module** – Mongoose aktiv
- **UsersModule, BranchesModule, TenantsModule** – Mongoose
- **AuthModule** – UsersService ilə işləyir
- **HealthModule** – MongooseHealthIndicator
- **AuditModule** – Mongoose
- **ProductsModule, InventoryModule, CartsModule** – hələ TypeORM (konvertasiya lazımdır)
- **OrdersModule, InvoicesModule, PaymentsModule** – hələ TypeORM
- **TransactionsModule, SeedModule, ImportExportModule** – hələ TypeORM

## Hazır Komponentlər

### 1. Paketlər
- `@nestjs/mongoose` və `mongoose` package.json-a əlavə edilib
- `npm install` icra edin

### 2. Konfiqurasiya
- `src/config/mongodb.config.ts` – MongoDB qoşulma konfiqurasiyası
- `configuration.ts` – `mongodb.uri` konfiqurasiyası
- `validation.ts` – `MONGODB_URI` env dəyişəni

### 3. Mongoose Schema-lar (hamısı hazırdır)

| Schema | Fayl | Collection |
|--------|------|------------|
| Tenant | `tenants/schemas/tenant.schema.ts` | tenants |
| Branch | `branches/schemas/branch.schema.ts` | branches |
| User | `users/schemas/user.schema.ts` | users |
| Product | `products/schemas/product.schema.ts` | products |
| Order | `orders/schemas/order.schema.ts` | orders |
| OrderItem | `orders/schemas/order-item.schema.ts` | order_items |
| Inventory | `inventory/schemas/inventory.schema.ts` | inventories |
| CartItem | `carts/schemas/cart-item.schema.ts` | cart_items |
| BranchCart | `carts/schemas/branch-cart.schema.ts` | branch_carts |
| Invoice | `invoices/schemas/invoice.schema.ts` | invoices |
| Payment | `payments/schemas/payment.schema.ts` | payments |
| Transaction | `transactions/schemas/transaction.schema.ts` | transactions |
| ManualAdjustment | `transactions/schemas/manual-adjustment.schema.ts` | manual_adjustments_log |
| AuditLog | `audit/schemas/audit-log.schema.ts` | audit_logs |
| ProductSubstitute | `products/schemas/product-substitute.schema.ts` | product_substitutes |
| RegistrationConfig | `users/schemas/registration-config.schema.ts` | registration_config |

Migration zamanı hər schema-ya `toJSON` transform əlavə edin ki, API cavablarında `id` sahəsi `_id.toString()` kimi qaytarsın (frontend uyğunluğu üçün).

## Migration Addımları

### Addım 1: MongoDB-ni Docker-ə əlavə et

`docker-compose.yml`-a MongoDB servisi əlavə et:

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: b2b_mongodb
    restart: unless-stopped
    ports:
      - '27017:27017'
    environment:
      MONGO_INITDB_DATABASE: b2b_inventory
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    environment:
      MONGODB_URI: mongodb://mongodb:27017/b2b_inventory
    depends_on:
      mongodb:
        condition: service_healthy

volumes:
  mongodb_data:
```

### Addım 2: app.module.ts – TypeORM-u Mongoose ilə əvəz et

```typescript
import { MongooseModule } from '@nestjs/mongoose';
import { getMongoConfig } from './config/mongodb.config';

// TypeOrmModule.forRootAsync(...) SİL
// Əvəzinə:
MongooseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: () => getMongoConfig(),
}),
```

### Addım 3: Modulların konvertasiyası

Hər modul üçün:

1. `TypeOrmModule.forFeature([Entity1, Entity2])` → `MongooseModule.forFeature([{ name: SchemaClass.name, schema: Schema }])`
2. `@InjectRepository(Entity)` → `@InjectModel(SchemaClass.name)`
3. `Repository<Entity>` → `Model<Document>`
4. TypeORM sorğuları → Mongoose sorğuları:
   - `repo.find({ where })` → `model.find(filter)`
   - `repo.findOne({ where })` → `model.findOne(filter)`
   - `repo.create(data)` + `repo.save()` → `new model(data).save()` və ya `model.create(data)`
   - `repo.update(id, data)` → `model.findByIdAndUpdate(id, data)`
   - `repo.delete(id)` → `model.findByIdAndDelete(id)`
5. Relations: `relations: ['branch']` → `.populate('branch')`

### Addım 4: Health modulu

`TypeOrmHealthIndicator` → `MongooseHealthIndicator`:

```typescript
import { MongooseHealthIndicator } from '@nestjs/terminus';

// constructor-də:
private readonly mongoose: MongooseHealthIndicator,

// check-də:
() => this.mongoose.pingCheck('mongodb', { timeout: 1500 }),
```

### Addım 5: ID formatı

- PostgreSQL: UUID (`id: string`)
- MongoDB: ObjectId (`_id: ObjectId`)
- Schema-larda `toJSON` transform `id` sahəsini `_id.toString()` kimi qaytarır
- API cavablarında `id` sahəsi avtomatik əlavə olunur

## Əsas Modulların Konvertasiya Sırası

1. **TenantsModule** (sadə)
2. **BranchesModule** (sadə)
3. **UsersModule** (Branch asılılığı)
4. **ProductsModule** (mürəkkəb – inventory, substitute)
5. **InventoryModule**
6. **CartsModule**
7. **OrdersModule** (çox mürəkkəb – ~1700 sətir)
8. **InvoicesModule**, **PaymentsModule**
9. **TransactionsModule** (StockCalculationService)
10. **AuditModule**
11. **SeedModule** (IsNull → null filter)

## Nümunə: UsersService konvertasiyası

```typescript
// Əvvəl (TypeORM)
@InjectRepository(User) private readonly usersRepository: Repository<User>,

async findByEmail(email: string) {
  return this.usersRepository.findOne({ 
    where: { email },
    relations: ['branch', 'tenant'],
  });
}

// Sonra (Mongoose)
@InjectModel(User.name) private readonly userModel: Model<UserDocument>,

async findByEmail(email: string) {
  return this.userModel
    .findOne({ email: email.toLowerCase() })
    .populate('branch')
    .populate('tenant')
    .lean()
    .exec();
}
```

## Məlumat Köçürməsi (opsional)

PostgreSQL məlumatlarını MongoDB-yə köçürmək üçün ayrıca skript yazmaq lazımdır:

1. PostgreSQL-dən export (COPY və ya pg_dump)
2. Məlumatların transformasiyası (UUID → ObjectId, relation id-lər)
3. MongoDB-yə import (mongoimport və ya Mongoose bulk insert)

## Qeydlər

- MongoDB `mongosh` və ya `mongo` ilə eyni formatda işləyir – fərq yalnız CLI alətindədir
- Migration tamamlanana qədər sistem PostgreSQL ilə işləyir
- Bütün schema-lar `.env`-də `MONGODB_URI` təyin olunanda test edilə bilər
