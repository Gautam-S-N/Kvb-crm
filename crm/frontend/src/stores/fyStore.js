import { create } from 'zustand';
import { getCurrentFY, getFYOptions } from './projectPlanStore';

/**
 * Global FY selector store.
 * All list pages (Leads, Sales, Quotations, PurchaseOrders, Tasks) read from here.
 */
const useFYStore = create((set) => ({
  selectedFY: getCurrentFY(),
  fyOptions:  getFYOptions(),

  setSelectedFY: (fy) => set({ selectedFY: fy }),
}));

export default useFYStore;
