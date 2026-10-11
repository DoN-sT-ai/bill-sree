import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from './supabaseClient.ts';
import {
  Store,
  User,
  Category,
  Product,
  StockMovement,
  Sale,
  SaleItem,
  Expense,
  AuditLog,
} from './db.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureUuid(val?: string | null): string {
  if (val && UUID_REGEX.test(val)) return val;
  return crypto.randomUUID();
}
function nullableUuid(val?: string | null): string | null {
  if (val && UUID_REGEX.test(val)) return val;
  return null;
}

export class SupabaseDb {
  // STORE
  static async getStore(storeId: string): Promise<Store | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    if (error) {
      console.error('Supabase getStore error:', error);
      return null;
    }
    return data as Store;
  }

  static async updateStore(storeId: string, updates: Partial<Store>): Promise<Store | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('stores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', storeId)
      .select()
      .single();
    if (error) {
      console.error('Supabase updateStore error:', error);
      throw new Error(error.message);
    }
    return data as Store;
  }

  // USERS
  static async getUsers(storeId: string): Promise<User[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase getUsers error:', error);
      return [];
    }
    return (data || []) as User[];
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();
    if (error) {
      console.error('Supabase getUserByEmail error:', error);
      return null;
    }
    return data as User | null;
  }

  static async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<User> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .insert({
        ...user,
        id: ensureUuid(user.id),
        created_by: nullableUuid(user.created_by),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error('Supabase createUser error:', error);
      throw new Error(error.message);
    }
    return data as User;
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      console.error('Supabase updateUser error:', error);
      throw new Error(error.message);
    }
    return data as User;
  }

  // CATEGORIES
  static async getCategories(storeId: string): Promise<Category[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .order('name', { ascending: true });
    if (error) {
      console.error('Supabase getCategories error:', error);
      return [];
    }
    return (data || []) as Category[];
  }

  static async createCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        id: ensureUuid((category as any).id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Category;
  }

  // PRODUCTS
  static async getProducts(storeId: string): Promise<Product[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('name', { ascending: true });
    if (error) {
      console.error('Supabase getProducts error:', error);
      return [];
    }
    return (data || []) as Product[];
  }

  static async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...product,
        id: ensureUuid((product as any).id),
        category_id: nullableUuid(product.category_id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Product;
  }

  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Product;
  }

  // STOCK MOVEMENTS
  static async getStockMovements(storeId: string, limit = 150): Promise<StockMovement[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Supabase getStockMovements error:', error);
      return [];
    }
    return (data || []) as StockMovement[];
  }

  static async createStockMovement(movement: Omit<StockMovement, 'id' | 'created_at'>): Promise<StockMovement> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        ...movement,
        id: ensureUuid((movement as any).id),
        user_id: nullableUuid(movement.user_id),
        reference_id: nullableUuid(movement.reference_id),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StockMovement;
  }

  // SALES
  static async getSales(storeId: string, limit = 200): Promise<Sale[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Supabase getSales error:', error);
      return [];
    }
    return (data || []) as Sale[];
  }

  static async getSaleByVerificationToken(token: string): Promise<Sale | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('verification_token', token.trim())
      .maybeSingle();
    if (error) {
      console.error('Supabase getSaleByVerificationToken error:', error);
      return null;
    }
    return data as Sale | null;
  }

  static async createSale(
    sale: Omit<Sale, 'id' | 'created_at' | 'items'>,
    items: Omit<SaleItem, 'id' | 'sale_id' | 'created_at'>[]
  ): Promise<Sale> {
    if (!supabase) throw new Error('Supabase client not initialized');
    
    // 1. Insert parent sale
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        ...sale,
        id: ensureUuid((sale as any).id),
        employee_id: nullableUuid(sale.employee_id),
        voided_by: nullableUuid(sale.voided_by),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (saleErr) throw new Error(saleErr.message);

    // 2. Insert sale items
    const preparedItems = items.map((item) => ({
      ...item,
      id: ensureUuid((item as any).id),
      sale_id: saleData.id,
      product_id: nullableUuid(item.product_id),
      created_at: new Date().toISOString(),
    }));

    const { data: itemsData, error: itemsErr } = await supabase
      .from('sale_items')
      .insert(preparedItems)
      .select();
    if (itemsErr) throw new Error(itemsErr.message);

    return { ...saleData, items: itemsData } as Sale;
  }

  static async voidSale(saleId: string, voidedBy: string, voidedByName: string, reason: string): Promise<Sale> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('sales')
      .update({
        status: 'VOIDED',
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        voided_by_name: voidedByName,
        void_reason: reason,
      })
      .eq('id', saleId)
      .select('*, items:sale_items(*)')
      .single();
    if (error) throw new Error(error.message);
    return data as Sale;
  }

  // EXPENSES
  static async getExpenses(storeId: string): Promise<Expense[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase getExpenses error:', error);
      return [];
    }
    return (data || []) as Expense[];
  }

  static async createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...expense,
        id: ensureUuid((expense as any).id),
        created_by: nullableUuid(expense.created_by),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Expense;
  }

  static async voidExpense(expenseId: string): Promise<Expense> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('expenses')
      .update({ status: 'VOIDED' })
      .eq('id', expenseId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Expense;
  }

  // AUDIT LOGS
  static async getAuditLogs(storeId: string, limit = 300): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Supabase getAuditLogs error:', error);
      return [];
    }
    return (data || []) as AuditLog[];
  }

  static async createAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        ...log,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error('Supabase createAuditLog error:', error);
    }
    return data as AuditLog;
  }
}
