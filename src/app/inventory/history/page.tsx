import { getStockMovementsAction } from "@/server/actions/inventory.actions";
import { StockHistoryView } from "@/components/inventory/StockHistoryView";

export const dynamic = "force-dynamic";

export default async function StockHistoryPage() {
  const res = await getStockMovementsAction();
  const movements = res.success && res.movements ? res.movements : [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <StockHistoryView movements={movements} />
    </div>
  );
}
