import crypto from 'crypto';
import { SupabaseDb } from './supabaseDb.ts';
import { isSupabaseConfigured } from './supabaseClient.ts';

// ============================================================
// TYPES — match Supabase schema exactly
// ============================================================

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  store_id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'ADMIN' | 'EMPLOYEE';
  active: boolean;
  last_login_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id?: string;
  name: string;
  sku: string;
  barcode: string;
  hsn_code?: string;
  description: string;
  purchase_price: number;
  purchase_tax_type?: 'EXCLUSIVE' | 'INCLUSIVE';
  selling_price: number;
  tax_rate: number;
  tax_type?: 'EXCLUSIVE' | 'INCLUSIVE';
  current_stock: number;
  minimum_stock: number;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'DAMAGE' | 'RETURN' | 'VOID' | 'INITIAL_STOCK';

export interface StockMovement {
  id: string;
  store_id: string;
  product_id: string;
  product_name: string;
  user_id: string;
  user_name: string;
  type: MovementType;
  quantity: number;
  before_stock: number;
  after_stock: number;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
  purchase_cost?: number;
  tax_rate?: number;
  tax_amount?: number;
  supplier_invoice?: string;
  supplier_gstin?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  barcode_snapshot: string;
  hsn_snapshot?: string;
  quantity: number;
  unit_price: number;
  purchase_price_snapshot: number;
  tax_rate: number;
  tax_amount: number;
  tax_type_snapshot?: 'EXCLUSIVE' | 'INCLUSIVE';
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  discount: number;
  line_total: number;
  created_at: string;
}

export interface Sale {
  id: string;
  store_id: string;
  bill_number: string;
  verification_token: string;
  employee_id: string;
  employee_name: string;
  subtotal: number;
  discount: number;
  tax: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gst_type?: 'INTRA_STATE' | 'INTER_STATE' | 'EXEMPT';
  tax_mode?: 'INCLUSIVE' | 'EXCLUSIVE' | 'AUTO';
  round_off?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string;
  total: number;
  payment_method: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
  status: 'COMPLETED' | 'VOIDED' | 'REFUNDED';
  notes?: string;
  created_at: string;
  voided_at?: string;
  voided_by?: string;
  voided_by_name?: string;
  void_reason?: string;
  items?: SaleItem[];
}

export interface Expense {
  id: string;
  store_id: string;
  created_by: string;
  created_by_name: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  status: 'ACTIVE' | 'VOIDED';
  created_at: string;
}

export interface AuditLog {
  id: string;
  store_id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before_data?: any;
  after_data?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface BillSequence {
  store_id: string;
  year: number;
  last_number: number;
}

export interface DatabaseSchema {
  stores: Store[];
  users: User[];
  categories: Category[];
  products: Product[];
  stock_movements: StockMovement[];
  sales: Sale[];
  sale_items: SaleItem[];
  expenses: Expense[];
  audit_logs: AuditLog[];
  bill_sequences: BillSequence[];
}

// ============================================================
// PASSWORD UTILITIES
// ============================================================

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const testHash = hashPassword(password, salt);
    const bufA = Buffer.from(testHash, 'hex');
    const bufB = Buffer.from(hash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_) {
    return false;
  }
}

// ============================================================
// IN-MEMORY CACHE — populated from Supabase on startup
// No hardcoded data. No local JSON file.
// ============================================================

class Database {
  private cache: DatabaseSchema = {
    stores: [],
    users: [],
    categories: [],
    products: [],
    stock_movements: [],
    sales: [],
    sale_items: [],
    expenses: [],
    audit_logs: [],
    bill_sequences: [],
  };

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  public waitForInit(): Promise<void> {
    return this.initPromise ?? Promise.resolve();
  }

  private async init() {
    if (!isSupabaseConfigured) {
      console.warn('⚠️  SUPABASE NOT CONFIGURED — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
      this.initialized = true;
      return;
    }
    await this.syncFromSupabase();
    this.initialized = true;
  }

  public async syncFromSupabase() {
    if (!isSupabaseConfigured) return;
    try {
      // Get the first (and only) store from Supabase
      const { supabase } = await import('./supabaseClient.ts');
      if (!supabase) return;

      const { data: storesData, error: storeErr } = await supabase.from('stores').select('*').limit(1);
      if (storeErr) {
        console.error('❌ Failed to fetch store from Supabase:', storeErr.message);
      }
      if (!storesData || storesData.length === 0) {
        console.warn('⚠️  No store returned from Supabase. Falling back to default Jayam Stores profile.');
        this.cache.stores = [{
          id: 'a0000000-0000-0000-0000-000000000001',
          name: 'Jayam Stores',
          code: 'STORE-01',
          address: '123 Main Commercial Street',
          phone: '+91 9876543210',
          email: 'jayam@gmail.com',
          gstin: '',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          invoice_prefix: 'BILL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
        return;
      }
      const storeId = storesData[0].id;
      this.cache.stores = storesData as Store[];

      const [
        users,
        categories,
        products,
        stock_movements,
        sales,
        expenses,
        audit_logs,
      ] = await Promise.all([
        SupabaseDb.getUsers(storeId),
        SupabaseDb.getCategories(storeId),
        SupabaseDb.getProducts(storeId),
        SupabaseDb.getStockMovements(storeId),
        SupabaseDb.getSales(storeId),
        SupabaseDb.getExpenses(storeId),
        SupabaseDb.getAuditLogs(storeId),
      ]);

      this.cache.users = users;
      if (categories.length === 0) {
        const { DEFAULT_STORE_CATEGORIES } = await import('./services/productService.ts');
        const seeded = await SupabaseDb.seedDefaultCategories(storeId, DEFAULT_STORE_CATEGORIES);
        this.cache.categories = seeded.length > 0 ? seeded : [];
      } else {
        this.cache.categories = categories;
      }
      this.cache.products = products;
      this.cache.stock_movements = stock_movements;
      this.cache.sales = sales;
      this.cache.expenses = expenses;
      this.cache.audit_logs = audit_logs;

      // Flatten sale items
      const saleItems: SaleItem[] = [];
      sales.forEach(s => {
        if (s.items && Array.isArray(s.items)) {
          saleItems.push(...s.items);
        }
      });
      this.cache.sale_items = saleItems;

      console.log(`✅ Supabase sync complete — store: "${storesData[0].name}", users: ${users.length}, products: ${products.length}`);
    } catch (err) {
      console.error('❌ Failed to sync from Supabase:', err);
    }
  }

  // save() is a no-op now — all writes go directly to Supabase via services
  public save() {
    // No-op: data is persisted to Supabase directly in each service
  }

  // Getters for in-memory cache (used as read-through cache)
  get stores() { return this.cache.stores; }
  get users() { return this.cache.users; }
  get categories() { return this.cache.categories; }
  get products() { return this.cache.products; }
  get stock_movements() { return this.cache.stock_movements; }
  get sales() { return this.cache.sales; }
  get sale_items() { return this.cache.sale_items; }
  get expenses() { return this.cache.expenses; }
  get audit_logs() { return this.cache.audit_logs; }
  get bill_sequences() { return this.cache.bill_sequences; }

  private sequenceCache: Map<string, number> = new Map();

  // Sequential bill number — instant in-memory generation with non-blocking background sync
  public async getNextBillNumberAsync(storeId: string): Promise<string> {
    const store = this.cache.stores.find(s => s.id === storeId);
    if (!store) throw new Error('Store not found');

    const year = new Date().getFullYear();
    const cleanPrefix = (store.invoice_prefix && store.invoice_prefix !== 'INV' && store.invoice_prefix !== 'INV-' ? store.invoice_prefix : 'BILL').replace(/-+$/, '');
    const billPrefix = `${cleanPrefix}-${year}-`;
    const seqKey = `${storeId}_${year}`;

    let next = this.sequenceCache.get(seqKey);

    if (next === undefined) {
      // First time initialization — find max number from existing sales and sequences
      let maxFromSales = 0;
      this.cache.sales
        .filter(s => s.store_id === storeId && s.bill_number?.startsWith(billPrefix))
        .forEach(s => {
          const m = s.bill_number.match(/(\d+)$/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num) && num > maxFromSales) maxFromSales = num;
          }
        });

      if (isSupabaseConfigured) {
        try {
          const { supabase } = await import('./supabaseClient.ts');
          if (supabase) {
            const { data: existingSeq } = await supabase
              .from('bill_sequences')
              .select('last_number')
              .eq('store_id', storeId)
              .eq('year', year)
              .maybeSingle();
            const maxFromSeq = existingSeq?.last_number ?? 0;
            maxFromSales = Math.max(maxFromSales, maxFromSeq);
          }
        } catch (_) {}
      }

      next = maxFromSales + 1;
    } else {
      next = next + 1;
    }

    this.sequenceCache.set(seqKey, next);

    // Sync sequence to Supabase in the background (fire-and-forget, non-blocking)
    if (isSupabaseConfigured) {
      import('./supabaseClient.ts').then(({ supabase }) => {
        if (supabase) {
          Promise.resolve(
            supabase
              .from('bill_sequences')
              .upsert({ store_id: storeId, year, last_number: next }, { onConflict: 'store_id,year' })
          ).catch(() => {});
        }
      }).catch(() => {});
    }

    const formattedNum = String(next).padStart(6, '0');
    return `${billPrefix}${formattedNum}`;
  }

  // Sync-compatible wrapper (for services not yet async)
  public getNextBillNumber(storeId: string): string {
    const store = this.cache.stores.find(s => s.id === storeId);
    if (!store) throw new Error('Store not found');
    const year = new Date().getFullYear();
    let seq = this.cache.bill_sequences.find(s => s.store_id === storeId && s.year === year);
    if (!seq) {
      seq = { store_id: storeId, year, last_number: 0 };
      this.cache.bill_sequences.push(seq);
    }
    seq.last_number += 1;
    const formattedNum = String(seq.last_number).padStart(6, '0');
    const pfx = (store.invoice_prefix && store.invoice_prefix !== 'INV' && store.invoice_prefix !== 'INV-' ? store.invoice_prefix : 'BILL').replace(/-+$/, '');
    return `${pfx}-${year}-${formattedNum}`;
  }
}

export const db = new Database();
