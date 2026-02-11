import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { BranchesService } from '../branches/branches.service';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserRole } from '../../common/constants/roles.enum';

type TenantLike = { id?: string; name?: string; contactEmail?: string };
type BranchLike = { id: string; name?: string };

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly branchesService: BranchesService,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly tenantsService: TenantsService,
  ) {}

  async onApplicationBootstrap() {
    const shouldRunSeed = process.env.RUN_SEED === 'true';
    const isProduction = process.env.NODE_ENV === 'production';

    if (!shouldRunSeed || isProduction) {
      this.logger.log('✅ Seed service SÖNDÜRÜLÜB. Məlumatlar qorunur.');
      this.logger.log(
        `RUN_SEED=${process.env.RUN_SEED || 'undefined'}, NODE_ENV=${process.env.NODE_ENV || 'undefined'}`,
      );
      this.logger.log(
        '⚠️ QEYD: Seed service aktiv deyil - demo məhsullar YARADILMAYACAQ və mövcud məhsullar SİLİNMEYƏCƏK',
      );
      this.logger.log(
        '🔒 Məlumatların sabit qalması üçün seed service TAMAMİLƏ SÖNDÜRÜLÜB',
      );
      return;
    }

    this.logger.warn(
      '⚠️ XƏBƏRDARLIQ: Seed service aktivdir! Demo məlumatları yaradılacaq.',
    );
    this.logger.warn(
      '⚠️ Bu məlumatların silinməsinə və ya yenilənməsinə səbəb ola bilər.',
    );
    this.logger.log('Seed started: demo məlumatları yaradılır (RUN_SEED=true)');

    const magazinEmail = 'magazin@demo.az';
    const allTenants = (await this.tenantsService.findAll()) as TenantLike[];
    let magazinTenant = allTenants.find((t) => t.contactEmail === magazinEmail);

    if (!magazinTenant) {
      magazinTenant = (await this.tenantsService.create({
        name: 'Mağazin Müştərisi',
        description: 'Demo mağazin müştərisi',
        contactEmail: magazinEmail,
        contactPhone: '+994 XX XXX XX XX',
      })) as TenantLike;
      this.logger.log(
        `Tenant yaradıldı: ${magazinTenant?.name ?? 'Mağazin Müştərisi'}`,
      );
    } else {
      this.logger.log(
        `Tenant artıq mövcuddur: ${magazinTenant.name ?? 'Mağazin Müştərisi'}`,
      );
    }

    const branches = (await Promise.all([
      this.branchesService.ensureBranch('BAKU', 'Bakı Mərkəz'),
      this.branchesService.ensureBranch('GANJA', 'Gəncə Filialı'),
      this.branchesService.ensureBranch('SUMQAYIT', 'Sumqayıt Filialı'),
    ])) as BranchLike[];

    const defaultPassword = 'Admin123!';

    const testUsers = [
      {
        email: 'admin@demo.az',
        password: defaultPassword,
        role: UserRole.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        branchId: undefined as string | undefined,
      },
      {
        email: 'service@demo.az',
        password: defaultPassword,
        role: UserRole.BRANCH_MANAGER,
        firstName: 'İkinci',
        lastName: 'Admin',
        branchId: branches[0]?.id,
      },
      {
        email: 'magazin@demo.az',
        password: defaultPassword,
        role: UserRole.USER,
        firstName: 'Mağazin',
        lastName: 'İstifadəçi',
        branchId: branches[0]?.id,
      },
    ];

    for (const userData of testUsers) {
      const existing = await this.usersService.findByEmail(userData.email);
      if (!existing) {
        try {
          await this.usersService.createUser(userData);
          this.logger.log(`Test istifadəçisi yaradıldı: ${userData.email}`);
        } catch (error) {
          this.logger.warn(
            `Test istifadəçisi yaradıla bilmədi: ${userData.email} - ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        this.logger.log(`Test istifadəçisi artıq mövcuddur: ${userData.email}`);
      }
    }

    this.logger.log(
      `Seed completed: test istifadəçiləri yaradıldı (şifrə: ${defaultPassword})`,
    );
  }
}
