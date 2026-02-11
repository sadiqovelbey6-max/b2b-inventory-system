# Frontend – Solob2b.az Web UI

React + TypeScript + Vite ilə qurulmuş idarəetmə paneli.

## Skriptlər

```bash
npm install           # asılılıqları yüklə
npm run dev -- --host # http://localhost:4200
npm run lint          # ESLint
npm run test          # Vitest + Testing Library
npm run test:watch    # Testlərin watch rejimi
npm run test:coverage # Coverage hesabatı
npm run build         # Production build (dist/)
npm run cy:open       # Cypress UI (end-to-end ssenariləri)
npm run cy:run        # Cypress headless
```

## İnteqrasiya

- **React Query**: `src/lib/queryClient.ts` default konfiqurasiya, `queryKeys` utili.
- **Toast sistemi**: `ToastProvider`, `useToast`, `toastBus` – uğur/xəta mesajları və global status.
- **Global loader**: React Query sorğu/mutation aktiv olduqda yuxarıda loading indicator.
- **Səhifələr**: Dashboard, Products, Code Lookup, Cart, Orders, Invoices, Payments, Import/Export, Audit Logs, Admin.

## Faydalı fayllar

- `src/hooks/use*` – məlumat qatına çıxış hook-ları.
- `src/features/*` – səhifə komponentləri.
- `src/services/importExportService.ts` – CSV/PDF import/export stub-ları.
- `vitest.setup.ts` – Testing Library jest-dom inteqrasiyası.

## Test və keyfiyyət

- Vitest sınaqları `npm run test` ilə çalışır.
- Jest-dom və Testing Library (render, fireEvent) istifadə olunur.
- `tsconfig.app.json` test fayllarını build prosesindən kənar tutur.
- Cypress ilə əsas istifadəçi axınları (login, dashboard) üçün end-to-end testlər mövcuddur.

## Gələcək addımlar

- Sənəd yükləmə/export endpoint-lərinin implementasiyası.
- Audit log servisində filtr dəstəyinin backend tərəfdə tamamlanması.
- Cypress ilə end-to-end ssenariləri.
