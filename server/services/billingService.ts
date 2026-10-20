import { db, Sale, SaleItem, StockMovement } from '../db.ts';
import { AuditService } from './auditService.ts';
import { SupabaseDb } from '../supabaseDb.ts';
import { isSupabaseConfigured } from '../supabaseClient.ts';
import crypto from 'crypto';

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  taxType?: 'INCLUSIVE' | 'EXCLUSIVE';
}

export interface CreateSaleInput {
  items: CreateSaleItemInput[];
  discount?: number;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
  notes?: string;
  gstType?: 'INTRA_STATE' | 'INTER_STATE' | 'EXEMPT';
  taxMode?: 'INCLUSIVE' | 'EXCLUSIVE' | 'AUTO';
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
}

export class BillingService {
  static async createSale(params: {
    storeId: string;
    userId: string;
    userName: string;
    payload: CreateSaleInput;
  }): Promise<Sale> {
    const { storeId, userId, userName, payload } = params;

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }

    const validPaymentMethods = ['CASH', 'UPI', 'CARD', 'OTHER'];
    if (!validPaymentMethods.includes(payload.paymentMethod)) {
      throw new Error('Invalid payment method');
    }

    const gstType = payload.gstType || 'INTRA_STATE';
    const globalTaxMode = payload.taxMode;

    // 1. Group quantities
    const itemMap = new Map<string, number>();
    const itemTaxTypeMap = new Map<string, 'INCLUSIVE' | 'EXCLUSIVE' | undefined>();
    for (const item of payload.items) {
      const q = Number(item.quantity);
      if (isNaN(q) || q <= 0) throw new Error('All item quantities must be greater than zero');
      itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + q);
      if (item.taxType) itemTaxTypeMap.set(item.productId, item.taxType);
    }

    // 2. Validate products and compute totals
    const verifiedProducts: Array<{
      product: typeof db.products[0];
      quantity: number;
      unitPrice: number;
      taxRate: number;
      taxType: 'EXCLUSIVE' | 'INCLUSIVE';
      lineSubtotal: number;
      lineTax: number;
      lineTotal: number;
      cgst: number;
      sgst: number;
      igst: number;
    }> = [];

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    for (const [productId, qty] of itemMap.entries()) {
      const product = db.products.find(p => p.id === productId && p.store_id === storeId);
      if (!product) throw new Error(`Product not found with ID ${productId}`);
      if (!product.active) throw new Error(`Product "${product.name}" is deactivated and cannot be sold`);
      if (product.current_stock < qty) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.current_stock}, requested: ${qty}`);
      }

      const unitPrice = round2(product.selling_price);
      let taxRate = round2(product.tax_rate || 0);
      if (gstType === 'EXEMPT') taxRate = 0;

      const chosenTaxType: 'EXCLUSIVE' | 'INCLUSIVE' =
        itemTaxTypeMap.get(productId) ||
        (globalTaxMode && globalTaxMode !== 'AUTO' ? globalTaxMode : product.tax_type) ||
        'EXCLUSIVE';

      let lineSubtotal: number, lineTax: number, lineTotal: number;

      if (chosenTaxType === 'INCLUSIVE' && taxRate > 0) {
        lineTotal = round2(qty * unitPrice);
        lineSubtotal = round2(lineTotal / (1 + taxRate / 100));
        lineTax = round2(lineTotal - lineSubtotal);
      } else {
        lineSubtotal = round2(qty * unitPrice);
        lineTax = round2(lineSubtotal * (taxRate / 100));
        lineTotal = round2(lineSubtotal + lineTax);
      }

      let itemCGST = 0, itemSGST = 0, itemIGST = 0;
      if (gstType === 'INTER_STATE') {
        itemIGST = lineTax;
      } else if (gstType === 'INTRA_STATE') {
        itemCGST = round2(lineTax / 2);
        itemSGST = round2(lineTax - itemCGST);
      }

      calculatedSubtotal = round2(calculatedSubtotal + lineSubtotal);
      calculatedTax = round2(calculatedTax + lineTax);
      totalCGST = round2(totalCGST + itemCGST);
      totalSGST = round2(totalSGST + itemSGST);
      totalIGST = round2(totalIGST + itemIGST);

      verifiedProducts.push({ product, quantity: qty, unitPrice, taxRate, taxType: chosenTaxType, lineSubtotal, lineTax, lineTotal, cgst: itemCGST, sgst: itemSGST, igst: itemIGST });
    }

    // 3. Discount
    let appliedDiscount = round2(Math.max(0, Number(payload.discount) || 0));
    if (appliedDiscount > calculatedSubtotal + calculatedTax) {
      throw new Error('Discount cannot exceed the total bill amount');
    }
    const netBeforeRound = calculatedSubtotal + calculatedTax - appliedDiscount;
    const roundedTotal = Math.round(netBeforeRound);
    const roundOff = round2(roundedTotal - netBeforeRound);

    // 4. Get bill number (from Supabase or local)
    const billNumber = await db.getNextBillNumberAsync(storeId);
    const verificationToken = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const saleItems: SaleItem[] = [];
    const stockMovements: Omit<StockMovement, 'id' | 'created_at'>[] = [];

    // 5. Build items and movements, deduct stock from cache
    for (const vp of verifiedProducts) {
      const { product, quantity, unitPrice, taxRate, lineSubtotal, lineTax, lineTotal, cgst, sgst, igst } = vp;
      const beforeStock = product.current_stock;
      const afterStock = beforeStock - quantity;

      product.current_stock = afterStock;
      product.updated_at = now;

      saleItems.push({
        id: crypto.randomUUID(),
        sale_id: saleId,
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        barcode_snapshot: product.barcode,
        hsn_snapshot: product.hsn_code || '',
        quantity,
        unit_price: unitPrice,
        purchase_price_snapshot: product.purchase_price,
        tax_rate: taxRate,
        tax_amount: lineTax,
        tax_type_snapshot: vp.taxType,
        taxable_value: lineSubtotal,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        discount: 0,
        line_total: lineTotal,
        created_at: now,
      });

      stockMovements.push({
        store_id: storeId,
        product_id: product.id,
        product_name: product.name,
        user_id: userId,
        user_name: userName,
        type: 'SALE',
        quantity: -quantity,
        before_stock: beforeStock,
        after_stock: afterStock,
        reason: `Sold on bill #${billNumber}`,
        reference_type: 'SALE',
        reference_id: saleId,
      });
    }

    const newSale: Sale = {
      id: saleId,
      store_id: storeId,
      bill_number: billNumber,
      verification_token: verificationToken,
      employee_id: userId,
      employee_name: userName,
      subtotal: calculatedSubtotal,
      discount: appliedDiscount,
      tax: calculatedTax,
      cgst: totalCGST,
      sgst: totalSGST,
      igst: totalIGST,
      gst_type: gstType,
      tax_mode: payload.taxMode,
      round_off: roundOff,
      customer_name: payload.customerName?.trim() || undefined,
      customer_phone: payload.customerPhone?.trim() || undefined,
      customer_gstin: payload.customerGstin?.trim().toUpperCase() || undefined,
      total: roundedTotal,
      payment_method: payload.paymentMethod,
      status: 'COMPLETED',
      notes: payload.notes?.trim() || undefined,
      created_at: now,
      items: saleItems,
    };

    // 6. Persist to Supabase (primary) or local cache
    if (isSupabaseConfigured) {
      let saved: Sale;
      try {
        const [saleResult] = await Promise.all([
          SupabaseDb.createSale(
            { ...newSale, items: undefined } as any,
            saleItems.map(({ id, sale_id, created_at, ...rest }) => rest)
          ),
          SupabaseDb.createStockMovementsBatch(stockMovements).catch(err => {
            console.error('Stock movements batch error:', err);
          }),
          Promise.all(
            verifiedProducts.map(vp =>
              SupabaseDb.updateProduct(vp.product.id, {
                current_stock: vp.product.current_stock,
                updated_at: now,
              }).catch(() => {})
            )
          ),
        ]);
        saved = saleResult;
      } catch (insertErr: any) {
        const msg = String(insertErr?.message || '');
        if (msg.includes('sales_bill_number_key') || msg.includes('unique constraint') || msg.includes('duplicate key')) {
          console.warn('Bill number collision detected, generating next sequence and retrying...');
          const retryBillNumber = await db.getNextBillNumberAsync(storeId);
          newSale.bill_number = retryBillNumber;
          saved = await SupabaseDb.createSale(
            { ...newSale, items: undefined } as any,
            saleItems.map(({ id, sale_id, created_at, ...rest }) => rest)
          );
        } else {
          throw insertErr;
        }
      }

      // Update local cache
      db.sales.unshift(saved);
      db.sale_items.push(...saleItems);
      db.stock_movements.unshift(...(stockMovements as StockMovement[]));
    } else {
      // Local only
      db.sales.unshift(newSale);
      db.sale_items.push(...saleItems);
      db.stock_movements.unshift(...(stockMovements as StockMovement[]));
    }

    AuditService.log({
      storeId, userId, userName, action: 'SALE_CREATED', entityType: 'SALE', entityId: newSale.id,
      afterData: { billNumber: newSale.bill_number, total: newSale.total, paymentMethod: newSale.payment_method, itemCount: saleItems.length },
    });

    return { ...newSale, items: saleItems };
  }

  static async voidSale(params: {
    storeId: string;
    userId: string;
    userName: string;
    saleId: string;
    reason: string;
  }): Promise<Sale> {
    const { storeId, userId, userName, saleId, reason } = params;

    if (!reason || reason.trim().length === 0) throw new Error('A reason is mandatory for voiding a bill');

    const sale = db.sales.find(s => s.id === saleId && s.store_id === storeId);
    if (!sale) throw new Error('Sale record not found');
    if (sale.status === 'VOIDED') throw new Error('This bill is already voided');

    const saleItemsForSale = db.sale_items.filter(si => si.sale_id === sale.id);
    const now = new Date().toISOString();

    // Restore stock
    const stockRestores: Array<{ productId: string; newStock: number }> = [];
    for (const item of saleItemsForSale) {
      const product = db.products.find(p => p.id === item.product_id && p.store_id === storeId);
      if (product) {
        const beforeStock = product.current_stock;
        const afterStock = beforeStock + item.quantity;
        product.current_stock = afterStock;
        product.updated_at = now;
        stockRestores.push({ productId: product.id, newStock: afterStock });

        const voidMov = {
          store_id: storeId, product_id: product.id, product_name: product.name,
          user_id: userId, user_name: userName, type: 'VOID' as const,
          quantity: item.quantity, before_stock: beforeStock, after_stock: afterStock,
          reason: `Stock restored from voided bill #${sale.bill_number}: ${reason.trim()}`,
          reference_type: 'SALE_VOID', reference_id: sale.id,
        };

        if (isSupabaseConfigured) {
          SupabaseDb.createStockMovement(voidMov).catch(() => {});
          SupabaseDb.updateProduct(product.id, { current_stock: afterStock, updated_at: now }).catch(() => {});
        }
        db.stock_movements.unshift(voidMov as StockMovement);
      }
    }

    sale.status = 'VOIDED';
    sale.voided_at = now;
    sale.voided_by = userId;
    sale.voided_by_name = userName;
    sale.void_reason = reason.trim();

    if (isSupabaseConfigured) {
      await SupabaseDb.voidSale(saleId, userId, userName, reason.trim());
    }

    AuditService.log({
      storeId, userId, userName, action: 'SALE_VOIDED', entityType: 'SALE', entityId: sale.id,
      afterData: { billNumber: sale.bill_number, voidReason: sale.void_reason, voidedAt: sale.voided_at },
    });

    return sale;
  }

  static getSales(storeId: string, options?: {
    search?: string;
    from?: string;
    to?: string;
    employeeId?: string;
    paymentMethod?: string;
    status?: string;
    limit?: number;
  }) {
    let list = db.sales.filter(s => s.store_id === storeId);

    if (options?.employeeId) list = list.filter(s => s.employee_id === options.employeeId);
    if (options?.paymentMethod) list = list.filter(s => s.payment_method === options.paymentMethod);
    if (options?.status) list = list.filter(s => s.status === options.status);

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(s =>
        s.bill_number.toLowerCase().includes(q) ||
        s.employee_name.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    if (options?.from) {
      const fromDate = new Date(options.from).getTime();
      list = list.filter(s => new Date(s.created_at).getTime() >= fromDate);
    }

    if (options?.to) {
      const toDate = new Date(options.to).getTime() + 86400000;
      list = list.filter(s => new Date(s.created_at).getTime() <= toDate);
    }

    const limit = options?.limit || 200;
    return list.slice(0, limit).map(s => ({
      ...s,
      items: db.sale_items.filter(si => si.sale_id === s.id),
    }));
  }

  static getSaleById(storeId: string, saleId: string) {
    const sale = db.sales.find(s => s.id === saleId && s.store_id === storeId);
    if (!sale) throw new Error('Sale not found');
    const items = db.sale_items.filter(si => si.sale_id === sale.id);
    return { ...sale, items };
  }
}
