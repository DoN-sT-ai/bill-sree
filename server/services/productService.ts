import { db, Product, Category } from '../db.ts';
import { AuditService } from './auditService.ts';
import { SupabaseDb } from '../supabaseDb.ts';
import { isSupabaseConfigured } from '../supabaseClient.ts';
import crypto from 'crypto';

export class ProductService {
  static listProducts(storeId: string, options?: {
    search?: string;
    barcode?: string;
    categoryId?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
    activeOnly?: boolean;
  }) {
    let list = db.products.filter(p => p.store_id === storeId);

    if (options?.activeOnly !== false) {
      list = list.filter(p => p.active);
    }

    if (options?.barcode) {
      const b = options.barcode.trim();
      list = list.filter(p => p.barcode === b);
      return list;
    }

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (options?.categoryId) {
      list = list.filter(p => p.category_id === options.categoryId);
    }

    if (options?.lowStock) {
      list = list.filter(p => p.current_stock <= p.minimum_stock && p.current_stock > 0);
    }

    if (options?.outOfStock) {
      list = list.filter(p => p.current_stock <= 0);
    }

    return list;
  }

  static getProduct(storeId: string, productId: string) {
    const prod = db.products.find(p => p.id === productId && p.store_id === storeId);
    if (!prod) throw new Error('Product not found');
    return prod;
  }

  static async createProduct(storeId: string, userId: string, userName: string, payload: {
    name: string;
    sku: string;
    barcode: string;
    hsnCode?: string;
    categoryId?: string;
    description?: string;
    purchasePrice: number;
    purchaseTaxType?: 'EXCLUSIVE' | 'INCLUSIVE';
    sellingPrice: number;
    taxRate: number;
    taxType?: 'EXCLUSIVE' | 'INCLUSIVE';
    currentStock: number;
    minimumStock: number;
    unit?: string;
  }) {
    const cleanSku = payload.sku.trim();
    const cleanBarcode = payload.barcode.trim();

    // Check uniqueness against cache
    if (cleanSku && db.products.some(p => p.store_id === storeId && p.sku.toLowerCase() === cleanSku.toLowerCase())) {
      throw new Error(`SKU "${cleanSku}" is already in use by another product`);
    }
    if (cleanBarcode && db.products.some(p => p.store_id === storeId && p.barcode.toLowerCase() === cleanBarcode.toLowerCase())) {
      throw new Error(`Barcode "${cleanBarcode}" is already in use by another product`);
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: crypto.randomUUID(),
      store_id: storeId,
      category_id: payload.categoryId && payload.categoryId.trim() ? payload.categoryId.trim() : undefined,
      name: payload.name.trim(),
      sku: cleanSku,
      barcode: cleanBarcode,
      hsn_code: payload.hsnCode?.trim() || '',
      description: payload.description || '',
      purchase_price: Math.max(0, Number(payload.purchasePrice) || 0),
      purchase_tax_type: payload.purchaseTaxType || 'EXCLUSIVE',
      selling_price: Math.max(0, Number(payload.sellingPrice) || 0),
      tax_rate: Math.max(0, Number(payload.taxRate) || 0),
      tax_type: payload.taxType || 'EXCLUSIVE',
      current_stock: Math.max(0, Number(payload.currentStock) || 0),
      minimum_stock: Math.max(0, Number(payload.minimumStock) || 0),
      unit: payload.unit || 'piece',
      active: true,
      created_at: now,
      updated_at: now,
    };

    // Write to Supabase first (primary store)
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createProduct(newProduct);
      db.products.push(saved); // update cache

      if (saved.current_stock > 0) {
        const movement = {
          store_id: storeId,
          product_id: saved.id,
          product_name: saved.name,
          user_id: userId,
          user_name: userName,
          type: 'INITIAL_STOCK' as const,
          quantity: saved.current_stock,
          before_stock: 0,
          after_stock: saved.current_stock,
          reason: 'Initial stock on product creation',
        };
        const savedMov = await SupabaseDb.createStockMovement(movement);
        db.stock_movements.unshift(savedMov);
      }

      AuditService.log({
        storeId, userId, userName, action: 'PRODUCT_CREATED', entityType: 'PRODUCT', entityId: saved.id,
        afterData: { name: saved.name, sku: saved.sku, sellingPrice: saved.selling_price },
      });
      return saved;
    }

    // Local fallback
    db.products.push(newProduct);
    if (newProduct.current_stock > 0) {
      db.stock_movements.unshift({
        id: crypto.randomUUID(), store_id: storeId, product_id: newProduct.id,
        product_name: newProduct.name, user_id: userId, user_name: userName,
        type: 'INITIAL_STOCK', quantity: newProduct.current_stock,
        before_stock: 0, after_stock: newProduct.current_stock,
        reason: 'Initial stock on product creation', created_at: now,
      });
    }
    AuditService.log({
      storeId, userId, userName, action: 'PRODUCT_CREATED', entityType: 'PRODUCT', entityId: newProduct.id,
      afterData: { name: newProduct.name, sku: newProduct.sku, sellingPrice: newProduct.selling_price },
    });
    return newProduct;
  }

  static async updateProduct(storeId: string, userId: string, userName: string, productId: string, payload: Partial<{
    name: string;
    sku: string;
    barcode: string;
    hsnCode?: string;
    categoryId?: string;
    description?: string;
    purchasePrice: number;
    purchaseTaxType: 'EXCLUSIVE' | 'INCLUSIVE';
    sellingPrice: number;
    taxRate: number;
    taxType: 'EXCLUSIVE' | 'INCLUSIVE';
    minimumStock: number;
    unit?: string;
    active?: boolean;
  }>) {
    const product = this.getProduct(storeId, productId);
    const beforeData = { ...product };

    if (payload.sku && payload.sku !== product.sku) {
      const exists = db.products.some(p => p.store_id === storeId && p.id !== productId && p.sku.toLowerCase() === payload.sku!.toLowerCase());
      if (exists) throw new Error(`SKU "${payload.sku}" already exists`);
      product.sku = payload.sku;
    }
    if (payload.barcode && payload.barcode !== product.barcode) {
      const exists = db.products.some(p => p.store_id === storeId && p.id !== productId && p.barcode.toLowerCase() === payload.barcode!.toLowerCase());
      if (exists) throw new Error(`Barcode "${payload.barcode}" already exists`);
      product.barcode = payload.barcode;
    }

    if (payload.hsnCode !== undefined) product.hsn_code = payload.hsnCode.trim();
    if (payload.name !== undefined) product.name = payload.name.trim();
    if (payload.categoryId !== undefined) product.category_id = payload.categoryId;
    if (payload.description !== undefined) product.description = payload.description;
    if (payload.purchasePrice !== undefined) product.purchase_price = Math.max(0, Number(payload.purchasePrice));
    if (payload.purchaseTaxType !== undefined) product.purchase_tax_type = payload.purchaseTaxType;
    if (payload.sellingPrice !== undefined) product.selling_price = Math.max(0, Number(payload.sellingPrice));
    if (payload.taxRate !== undefined) product.tax_rate = Math.max(0, Number(payload.taxRate));
    if (payload.taxType !== undefined) product.tax_type = payload.taxType;
    if (payload.minimumStock !== undefined) product.minimum_stock = Math.max(0, Number(payload.minimumStock));
    if (payload.unit !== undefined) product.unit = payload.unit;
    if (payload.active !== undefined) product.active = payload.active;
    product.updated_at = new Date().toISOString();

    if (isSupabaseConfigured) {
      await SupabaseDb.updateProduct(productId, product);
    }

    AuditService.log({
      storeId, userId, userName, action: 'PRODUCT_UPDATED', entityType: 'PRODUCT', entityId: product.id,
      beforeData, afterData: { ...product },
    });
    return product;
  }

  static async toggleActive(storeId: string, userId: string, userName: string, productId: string, active: boolean) {
    const product = this.getProduct(storeId, productId);
    const before = product.active;
    product.active = active;
    product.updated_at = new Date().toISOString();

    if (isSupabaseConfigured) {
      await SupabaseDb.updateProduct(productId, { active, updated_at: product.updated_at });
    }

    AuditService.log({
      storeId, userId, userName,
      action: active ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entityType: 'PRODUCT', entityId: product.id,
      beforeData: { active: before }, afterData: { active },
    });
    return product;
  }
}

export class CategoryService {
  static listCategories(storeId: string) {
    return db.categories.filter(c => c.store_id === storeId && c.active);
  }

  static async createCategory(storeId: string, userId: string, userName: string, name: string, description: string) {
    const clean = name.trim();
    if (db.categories.some(c => c.store_id === storeId && c.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`Category "${clean}" already exists`);
    }

    const now = new Date().toISOString();
    const catPayload = {
      store_id: storeId,
      name: clean,
      description: description || '',
      active: true,
    };

    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createCategory(catPayload);
      db.categories.push(saved);
      AuditService.log({
        storeId, userId, userName, action: 'CATEGORY_CREATED', entityType: 'CATEGORY', entityId: saved.id,
        afterData: { name: saved.name },
      });
      return saved;
    }

    const cat: Category = {
      id: crypto.randomUUID(),
      ...catPayload,
      created_at: now,
      updated_at: now,
    };
    db.categories.push(cat);
    AuditService.log({
      storeId, userId, userName, action: 'CATEGORY_CREATED', entityType: 'CATEGORY', entityId: cat.id,
      afterData: { name: cat.name },
    });
    return cat;
  }
}
