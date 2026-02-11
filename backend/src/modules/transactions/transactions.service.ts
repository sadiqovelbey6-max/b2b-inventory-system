import { Injectable } from '@nestjs/common';
import { StockCalculationService } from './stock-calculation.service';
import { ManualAdjustmentsService } from './manual-adjustments.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly stockCalculationService: StockCalculationService,
    private readonly manualAdjustmentsService: ManualAdjustmentsService,
  ) {}

  async publishStockUpdate() {
    return this.stockCalculationService.publishStockUpdate();
  }

  async getCalculatedStock(branchId?: string) {
    return this.stockCalculationService.getCalculatedStock(branchId);
  }

  async getPublishedStock(branchId?: string) {
    return this.stockCalculationService.getPublishedStock(branchId);
  }
}
