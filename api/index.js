var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/supabaseClient.ts
var supabaseClient_exports = {};
__export(supabaseClient_exports, {
  isSupabaseConfigured: () => isSupabaseConfigured,
  supabase: () => supabase
});
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
var supabaseUrl, supabaseKey, isSupabaseConfigured, supabase;
var init_supabaseClient = __esm({
  "server/supabaseClient.ts"() {
    dotenv.config();
    supabaseUrl = process.env.SUPABASE_URL || "";
    supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
    isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
    supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }) : null;
    if (isSupabaseConfigured) {
      console.log("\u26A1 Supabase database connection enabled:", supabaseUrl);
    } else {
      console.log("\u2139\uFE0F Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) not set yet.");
    }
  }
});

// server/supabaseDb.ts
var supabaseDb_exports = {};
__export(supabaseDb_exports, {
  SupabaseDb: () => SupabaseDb
});
import crypto from "crypto";
function ensureUuid(val) {
  if (val && UUID_REGEX.test(val)) return val;
  return crypto.randomUUID();
}
function nullableUuid(val) {
  if (val && UUID_REGEX.test(val)) return val;
  return null;
}
var UUID_REGEX, SupabaseDb;
var init_supabaseDb = __esm({
  "server/supabaseDb.ts"() {
    init_supabaseClient();
    UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    SupabaseDb = class {
      // STORE
      static async getStore(storeId) {
        if (!supabase) return null;
        const { data, error } = await supabase.from("stores").select("*").eq("id", storeId).single();
        if (error) {
          console.error("Supabase getStore error:", error);
          return null;
        }
        return data;
      }
      static async updateStore(storeId, updates) {
        if (!supabase) return null;
        const { data, error } = await supabase.from("stores").update({ ...updates, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", storeId).select().single();
        if (error) {
          console.error("Supabase updateStore error:", error);
          throw new Error(error.message);
        }
        return data;
      }
      // USERS
      static async getUsers(storeId) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("users").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
        if (error) {
          console.error("Supabase getUsers error:", error);
          return [];
        }
        return data || [];
      }
      static async getUserByEmail(email) {
        if (!supabase) return null;
        const { data, error } = await supabase.from("users").select("*").ilike("email", email.trim()).maybeSingle();
        if (error) {
          console.error("Supabase getUserByEmail error:", error);
          return null;
        }
        return data;
      }
      static async createUser(user) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("users").insert({
          ...user,
          id: ensureUuid(user.id),
          created_by: nullableUuid(user.created_by),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) {
          console.error("Supabase createUser error:", error);
          throw new Error(error.message);
        }
        return data;
      }
      static async updateUser(userId, updates) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("users").update({ ...updates, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId).select().single();
        if (error) {
          console.error("Supabase updateUser error:", error);
          throw new Error(error.message);
        }
        return data;
      }
      // CATEGORIES
      static async getCategories(storeId) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("categories").select("*").eq("store_id", storeId).order("name", { ascending: true });
        if (error) {
          console.error("Supabase getCategories error:", error);
          return [];
        }
        return data || [];
      }
      static async createCategory(category) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("categories").insert({
          ...category,
          id: ensureUuid(category.id),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      // PRODUCTS
      static async getProducts(storeId) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("products").select("*").eq("store_id", storeId).order("name", { ascending: true });
        if (error) {
          console.error("Supabase getProducts error:", error);
          return [];
        }
        return data || [];
      }
      static async createProduct(product) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("products").insert({
          ...product,
          id: ensureUuid(product.id),
          category_id: nullableUuid(product.category_id),
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      static async updateProduct(productId, updates) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("products").update({ ...updates, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", productId).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      // STOCK MOVEMENTS
      static async getStockMovements(storeId, limit = 150) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("stock_movements").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit);
        if (error) {
          console.error("Supabase getStockMovements error:", error);
          return [];
        }
        return data || [];
      }
      static async createStockMovement(movement) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("stock_movements").insert({
          ...movement,
          id: ensureUuid(movement.id),
          user_id: nullableUuid(movement.user_id),
          reference_id: nullableUuid(movement.reference_id),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      // SALES
      static async getSales(storeId, limit = 200) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("sales").select("*, items:sale_items(*)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit);
        if (error) {
          console.error("Supabase getSales error:", error);
          return [];
        }
        return data || [];
      }
      static async getSaleByVerificationToken(token) {
        if (!supabase) return null;
        const { data, error } = await supabase.from("sales").select("*, items:sale_items(*)").eq("verification_token", token.trim()).maybeSingle();
        if (error) {
          console.error("Supabase getSaleByVerificationToken error:", error);
          return null;
        }
        return data;
      }
      static async createSale(sale, items) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data: saleData, error: saleErr } = await supabase.from("sales").insert({
          ...sale,
          id: ensureUuid(sale.id),
          employee_id: nullableUuid(sale.employee_id),
          voided_by: nullableUuid(sale.voided_by),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (saleErr) throw new Error(saleErr.message);
        const preparedItems = items.map((item) => ({
          ...item,
          id: ensureUuid(item.id),
          sale_id: saleData.id,
          product_id: nullableUuid(item.product_id),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const { data: itemsData, error: itemsErr } = await supabase.from("sale_items").insert(preparedItems).select();
        if (itemsErr) throw new Error(itemsErr.message);
        return { ...saleData, items: itemsData };
      }
      static async voidSale(saleId, voidedBy, voidedByName, reason) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("sales").update({
          status: "VOIDED",
          voided_at: (/* @__PURE__ */ new Date()).toISOString(),
          voided_by: voidedBy,
          voided_by_name: voidedByName,
          void_reason: reason
        }).eq("id", saleId).select("*, items:sale_items(*)").single();
        if (error) throw new Error(error.message);
        return data;
      }
      // EXPENSES
      static async getExpenses(storeId) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("expenses").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
        if (error) {
          console.error("Supabase getExpenses error:", error);
          return [];
        }
        return data || [];
      }
      static async createExpense(expense) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("expenses").insert({
          ...expense,
          id: ensureUuid(expense.id),
          created_by: nullableUuid(expense.created_by),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      static async voidExpense(expenseId) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("expenses").update({ status: "VOIDED" }).eq("id", expenseId).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      // AUDIT LOGS
      static async getAuditLogs(storeId, limit = 300) {
        if (!supabase) return [];
        const { data, error } = await supabase.from("audit_logs").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(limit);
        if (error) {
          console.error("Supabase getAuditLogs error:", error);
          return [];
        }
        return data || [];
      }
      static async createAuditLog(log) {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data, error } = await supabase.from("audit_logs").insert({
          ...log,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }).select().single();
        if (error) {
          console.error("Supabase createAuditLog error:", error);
        }
        return data;
      }
    };
  }
});

// server.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// server/db.ts
init_supabaseDb();
init_supabaseClient();
import crypto2 from "crypto";
function hashPassword(password, salt) {
  return crypto2.scryptSync(password, salt, 64).toString("hex");
}
function generateSalt() {
  return crypto2.randomBytes(16).toString("hex");
}
function verifyPassword(password, hash, salt) {
  const testHash = hashPassword(password, salt);
  return crypto2.timingSafeEqual(Buffer.from(testHash, "hex"), Buffer.from(hash, "hex"));
}
var Database = class {
  constructor() {
    this.cache = {
      stores: [],
      users: [],
      categories: [],
      products: [],
      stock_movements: [],
      sales: [],
      sale_items: [],
      expenses: [],
      audit_logs: [],
      bill_sequences: []
    };
    this.initialized = false;
    this.initPromise = null;
    this.initPromise = this.init();
  }
  waitForInit() {
    return this.initPromise ?? Promise.resolve();
  }
  async init() {
    if (!isSupabaseConfigured) {
      console.warn("\u26A0\uFE0F  SUPABASE NOT CONFIGURED \u2014 set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
      this.initialized = true;
      return;
    }
    await this.syncFromSupabase();
    this.initialized = true;
  }
  async syncFromSupabase() {
    if (!isSupabaseConfigured) return;
    try {
      const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabaseClient(), supabaseClient_exports));
      if (!supabase2) return;
      const { data: storesData } = await supabase2.from("stores").select("*").limit(1);
      if (!storesData || storesData.length === 0) {
        console.warn("\u26A0\uFE0F  No store found in Supabase. Please insert a store row first.");
        return;
      }
      const storeId = storesData[0].id;
      this.cache.stores = storesData;
      const [
        users,
        categories,
        products,
        stock_movements,
        sales,
        expenses,
        audit_logs
      ] = await Promise.all([
        SupabaseDb.getUsers(storeId),
        SupabaseDb.getCategories(storeId),
        SupabaseDb.getProducts(storeId),
        SupabaseDb.getStockMovements(storeId),
        SupabaseDb.getSales(storeId),
        SupabaseDb.getExpenses(storeId),
        SupabaseDb.getAuditLogs(storeId)
      ]);
      this.cache.users = users;
      this.cache.categories = categories;
      this.cache.products = products;
      this.cache.stock_movements = stock_movements;
      this.cache.sales = sales;
      this.cache.expenses = expenses;
      this.cache.audit_logs = audit_logs;
      const saleItems = [];
      sales.forEach((s) => {
        if (s.items && Array.isArray(s.items)) {
          saleItems.push(...s.items);
        }
      });
      this.cache.sale_items = saleItems;
      console.log(`\u2705 Supabase sync complete \u2014 store: "${storesData[0].name}", users: ${users.length}, products: ${products.length}`);
    } catch (err) {
      console.error("\u274C Failed to sync from Supabase:", err);
    }
  }
  // save() is a no-op now — all writes go directly to Supabase via services
  save() {
  }
  // Getters for in-memory cache (used as read-through cache)
  get stores() {
    return this.cache.stores;
  }
  get users() {
    return this.cache.users;
  }
  get categories() {
    return this.cache.categories;
  }
  get products() {
    return this.cache.products;
  }
  get stock_movements() {
    return this.cache.stock_movements;
  }
  get sales() {
    return this.cache.sales;
  }
  get sale_items() {
    return this.cache.sale_items;
  }
  get expenses() {
    return this.cache.expenses;
  }
  get audit_logs() {
    return this.cache.audit_logs;
  }
  get bill_sequences() {
    return this.cache.bill_sequences;
  }
  // Sequential bill number — uses Supabase bill_sequences table if configured
  async getNextBillNumberAsync(storeId) {
    const store = this.cache.stores.find((s) => s.id === storeId);
    if (!store) throw new Error("Store not found");
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    if (isSupabaseConfigured) {
      const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabaseClient(), supabaseClient_exports));
      if (!supabase2) throw new Error("Supabase client not available");
      const { data, error } = await supabase2.rpc("increment_bill_sequence", {
        p_store_id: storeId,
        p_year: year
      });
      if (error) {
        const { data: existing } = await supabase2.from("bill_sequences").select("last_number").eq("store_id", storeId).eq("year", year).maybeSingle();
        const next = (existing?.last_number ?? 0) + 1;
        await supabase2.from("bill_sequences").upsert({ store_id: storeId, year, last_number: next }, { onConflict: "store_id,year" });
        const formattedNum3 = String(next).padStart(6, "0");
        return `${store.invoice_prefix || store.code || "INV"}-${year}-${formattedNum3}`;
      }
      const formattedNum2 = String(data).padStart(6, "0");
      return `${store.invoice_prefix || store.code || "INV"}-${year}-${formattedNum2}`;
    }
    let seq = this.cache.bill_sequences.find((s) => s.store_id === storeId && s.year === year);
    if (!seq) {
      seq = { store_id: storeId, year, last_number: 0 };
      this.cache.bill_sequences.push(seq);
    }
    seq.last_number += 1;
    const formattedNum = String(seq.last_number).padStart(6, "0");
    return `${store.invoice_prefix || store.code || "INV"}-${year}-${formattedNum}`;
  }
  // Sync-compatible wrapper (for services not yet async)
  getNextBillNumber(storeId) {
    const store = this.cache.stores.find((s) => s.id === storeId);
    if (!store) throw new Error("Store not found");
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    let seq = this.cache.bill_sequences.find((s) => s.store_id === storeId && s.year === year);
    if (!seq) {
      seq = { store_id: storeId, year, last_number: 0 };
      this.cache.bill_sequences.push(seq);
    }
    seq.last_number += 1;
    const formattedNum = String(seq.last_number).padStart(6, "0");
    return `${store.invoice_prefix || store.code || "INV"}-${year}-${formattedNum}`;
  }
};
var db = new Database();

// server/services/authService.ts
import crypto4 from "crypto";
init_supabaseDb();
init_supabaseClient();

// server/services/auditService.ts
import crypto3 from "crypto";
var AuditService = class {
  static log(params) {
    const entry = {
      id: crypto3.randomUUID(),
      store_id: params.storeId,
      user_id: params.userId,
      user_name: params.userName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      before_data: params.beforeData,
      after_data: params.afterData,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.audit_logs.unshift(entry);
    if (db.audit_logs.length > 5e3) {
      db.audit_logs.pop();
    }
    db.save();
    return entry;
  }
  static getLogs(storeId, filter) {
    let logs = db.audit_logs.filter((l) => l.store_id === storeId);
    if (filter?.action) {
      logs = logs.filter((l) => l.action.toLowerCase().includes(filter.action.toLowerCase()));
    }
    if (filter?.entityType) {
      logs = logs.filter((l) => l.entity_type.toLowerCase() === filter.entityType.toLowerCase());
    }
    const limit = filter?.limit || 100;
    return logs.slice(0, limit);
  }
};

// server/services/authService.ts
var activeSessions = /* @__PURE__ */ new Map();
function safeUser(u) {
  return {
    id: u.id,
    store_id: u.store_id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    last_login_at: u.last_login_at,
    created_at: u.created_at
  };
}
var AuthService = class {
  /**
   * Authenticate a user by looking up their record directly from Supabase (if configured)
   * or from the local in-memory database. This ensures logins always reflect the live
   * database state — no hardcoded credentials.
   */
  static async login(email, password, ip, userAgent) {
    const cleanEmail = email.trim().toLowerCase();
    let user = null;
    if (isSupabaseConfigured) {
      user = await SupabaseDb.getUserByEmail(cleanEmail);
    }
    if (!user && !isSupabaseConfigured) {
      user = db.users.find((u) => u.email.toLowerCase() === cleanEmail) ?? null;
    }
    if (!user) {
      if (isSupabaseConfigured) {
        try {
          const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabaseClient(), supabaseClient_exports));
          if (supabase2) {
            const { count } = await supabase2.from("users").select("*", { count: "exact", head: true });
            if (count === 0) {
              throw new Error("Supabase database is empty: Please run the seed SQL in your Supabase SQL Editor to create the admin user.");
            }
          }
        } catch (err) {
          if (err.message?.includes("Supabase database is empty")) {
            throw err;
          }
        }
      }
      AuditService.log({
        storeId: "global",
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        afterData: { email: cleanEmail, reason: "User not found" },
        ipAddress: ip,
        userAgent
      });
      throw new Error("Invalid email or password");
    }
    if (!user.active) {
      AuditService.log({
        storeId: user.store_id,
        userId: user.id,
        userName: user.name,
        action: "LOGIN_BLOCKED_INACTIVE",
        entityType: "AUTH",
        ipAddress: ip,
        userAgent
      });
      throw new Error("Your account has been deactivated. Please contact the administrator.");
    }
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      AuditService.log({
        storeId: user.store_id,
        userId: user.id,
        userName: user.name,
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        afterData: { email: cleanEmail, reason: "Password mismatch" },
        ipAddress: ip,
        userAgent
      });
      throw new Error("Invalid email or password");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(user.id, { last_login_at: now }).catch(() => {
      });
    } else {
      user.last_login_at = now;
      db.save();
    }
    const token = crypto4.randomBytes(32).toString("hex");
    const session = {
      userId: user.id,
      storeId: user.store_id,
      role: user.role,
      name: user.name,
      email: user.email,
      createdAt: Date.now()
    };
    activeSessions.set(token, session);
    AuditService.log({
      storeId: user.store_id,
      userId: user.id,
      userName: user.name,
      action: "LOGIN_SUCCESS",
      entityType: "AUTH",
      ipAddress: ip,
      userAgent
    });
    let store = null;
    if (isSupabaseConfigured) {
      store = await SupabaseDb.getStore(user.store_id);
    } else {
      store = db.stores.find((s) => s.id === user.store_id) ?? null;
    }
    if (isSupabaseConfigured && (!db.users.some((u) => u.id === user.id) || db.stores.length === 0)) {
      await db.syncFromSupabase().catch(() => {
      });
    }
    return {
      token,
      user: safeUser(user),
      store
    };
  }
  static getSession(token) {
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;
    let user = db.users.find((u) => u.id === session.userId && u.active);
    let store = user ? db.stores.find((s) => s.id === user.store_id) : db.stores.find((s) => s.id === session.storeId);
    if (!user) {
      return {
        user: {
          id: session.userId,
          store_id: session.storeId,
          name: session.name,
          email: session.email,
          role: session.role,
          active: true,
          last_login_at: void 0,
          created_at: new Date(session.createdAt).toISOString()
        },
        store: store || {
          id: session.storeId,
          name: "LedgerStore Supermarket",
          code: "STORE-01",
          currency: "INR",
          invoice_prefix: "INV-"
        },
        session
      };
    }
    return {
      user: safeUser(user),
      store: store || {
        id: session.storeId,
        name: "LedgerStore Supermarket",
        code: "STORE-01",
        currency: "INR",
        invoice_prefix: "INV-"
      },
      session
    };
  }
  static logout(token) {
    if (token) {
      const session = activeSessions.get(token);
      if (session) {
        AuditService.log({
          storeId: session.storeId,
          userId: session.userId,
          userName: session.name,
          action: "LOGOUT",
          entityType: "AUTH"
        });
      }
      activeSessions.delete(token);
    }
  }
};

// server/services/productService.ts
init_supabaseDb();
init_supabaseClient();
import crypto5 from "crypto";
var ProductService = class {
  static listProducts(storeId, options) {
    let list = db.products.filter((p) => p.store_id === storeId);
    if (options?.activeOnly !== false) {
      list = list.filter((p) => p.active);
    }
    if (options?.barcode) {
      const b = options.barcode.trim();
      list = list.filter((p) => p.barcode === b);
      return list;
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q) || p.description && p.description.toLowerCase().includes(q)
      );
    }
    if (options?.categoryId) {
      list = list.filter((p) => p.category_id === options.categoryId);
    }
    if (options?.lowStock) {
      list = list.filter((p) => p.current_stock <= p.minimum_stock && p.current_stock > 0);
    }
    if (options?.outOfStock) {
      list = list.filter((p) => p.current_stock <= 0);
    }
    return list;
  }
  static getProduct(storeId, productId) {
    const prod = db.products.find((p) => p.id === productId && p.store_id === storeId);
    if (!prod) throw new Error("Product not found");
    return prod;
  }
  static async createProduct(storeId, userId, userName, payload) {
    const cleanSku = payload.sku.trim();
    const cleanBarcode = payload.barcode.trim();
    if (cleanSku && db.products.some((p) => p.store_id === storeId && p.sku.toLowerCase() === cleanSku.toLowerCase())) {
      throw new Error(`SKU "${cleanSku}" is already in use by another product`);
    }
    if (cleanBarcode && db.products.some((p) => p.store_id === storeId && p.barcode.toLowerCase() === cleanBarcode.toLowerCase())) {
      throw new Error(`Barcode "${cleanBarcode}" is already in use by another product`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newProduct = {
      id: crypto5.randomUUID(),
      store_id: storeId,
      category_id: payload.categoryId && payload.categoryId.trim() ? payload.categoryId.trim() : void 0,
      name: payload.name.trim(),
      sku: cleanSku,
      barcode: cleanBarcode,
      hsn_code: payload.hsnCode?.trim() || "",
      description: payload.description || "",
      purchase_price: Math.max(0, Number(payload.purchasePrice) || 0),
      purchase_tax_type: payload.purchaseTaxType || "EXCLUSIVE",
      selling_price: Math.max(0, Number(payload.sellingPrice) || 0),
      tax_rate: Math.max(0, Number(payload.taxRate) || 0),
      tax_type: payload.taxType || "EXCLUSIVE",
      current_stock: Math.max(0, Number(payload.currentStock) || 0),
      minimum_stock: Math.max(0, Number(payload.minimumStock) || 0),
      unit: payload.unit || "piece",
      active: true,
      created_at: now,
      updated_at: now
    };
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createProduct(newProduct);
      db.products.push(saved);
      if (saved.current_stock > 0) {
        const movement = {
          store_id: storeId,
          product_id: saved.id,
          product_name: saved.name,
          user_id: userId,
          user_name: userName,
          type: "INITIAL_STOCK",
          quantity: saved.current_stock,
          before_stock: 0,
          after_stock: saved.current_stock,
          reason: "Initial stock on product creation"
        };
        const savedMov = await SupabaseDb.createStockMovement(movement);
        db.stock_movements.unshift(savedMov);
      }
      AuditService.log({
        storeId,
        userId,
        userName,
        action: "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: saved.id,
        afterData: { name: saved.name, sku: saved.sku, sellingPrice: saved.selling_price }
      });
      return saved;
    }
    db.products.push(newProduct);
    if (newProduct.current_stock > 0) {
      db.stock_movements.unshift({
        id: crypto5.randomUUID(),
        store_id: storeId,
        product_id: newProduct.id,
        product_name: newProduct.name,
        user_id: userId,
        user_name: userName,
        type: "INITIAL_STOCK",
        quantity: newProduct.current_stock,
        before_stock: 0,
        after_stock: newProduct.current_stock,
        reason: "Initial stock on product creation",
        created_at: now
      });
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "PRODUCT_CREATED",
      entityType: "PRODUCT",
      entityId: newProduct.id,
      afterData: { name: newProduct.name, sku: newProduct.sku, sellingPrice: newProduct.selling_price }
    });
    return newProduct;
  }
  static async updateProduct(storeId, userId, userName, productId, payload) {
    const product = this.getProduct(storeId, productId);
    const beforeData = { ...product };
    if (payload.sku && payload.sku !== product.sku) {
      const exists = db.products.some((p) => p.store_id === storeId && p.id !== productId && p.sku.toLowerCase() === payload.sku.toLowerCase());
      if (exists) throw new Error(`SKU "${payload.sku}" already exists`);
      product.sku = payload.sku;
    }
    if (payload.barcode && payload.barcode !== product.barcode) {
      const exists = db.products.some((p) => p.store_id === storeId && p.id !== productId && p.barcode.toLowerCase() === payload.barcode.toLowerCase());
      if (exists) throw new Error(`Barcode "${payload.barcode}" already exists`);
      product.barcode = payload.barcode;
    }
    if (payload.hsnCode !== void 0) product.hsn_code = payload.hsnCode.trim();
    if (payload.name !== void 0) product.name = payload.name.trim();
    if (payload.categoryId !== void 0) product.category_id = payload.categoryId;
    if (payload.description !== void 0) product.description = payload.description;
    if (payload.purchasePrice !== void 0) product.purchase_price = Math.max(0, Number(payload.purchasePrice));
    if (payload.purchaseTaxType !== void 0) product.purchase_tax_type = payload.purchaseTaxType;
    if (payload.sellingPrice !== void 0) product.selling_price = Math.max(0, Number(payload.sellingPrice));
    if (payload.taxRate !== void 0) product.tax_rate = Math.max(0, Number(payload.taxRate));
    if (payload.taxType !== void 0) product.tax_type = payload.taxType;
    if (payload.minimumStock !== void 0) product.minimum_stock = Math.max(0, Number(payload.minimumStock));
    if (payload.unit !== void 0) product.unit = payload.unit;
    if (payload.active !== void 0) product.active = payload.active;
    product.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (isSupabaseConfigured) {
      await SupabaseDb.updateProduct(productId, product);
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "PRODUCT_UPDATED",
      entityType: "PRODUCT",
      entityId: product.id,
      beforeData,
      afterData: { ...product }
    });
    return product;
  }
  static async toggleActive(storeId, userId, userName, productId, active) {
    const product = this.getProduct(storeId, productId);
    const before = product.active;
    product.active = active;
    product.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (isSupabaseConfigured) {
      await SupabaseDb.updateProduct(productId, { active, updated_at: product.updated_at });
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
      entityType: "PRODUCT",
      entityId: product.id,
      beforeData: { active: before },
      afterData: { active }
    });
    return product;
  }
};
var CategoryService = class {
  static listCategories(storeId) {
    return db.categories.filter((c) => c.store_id === storeId && c.active);
  }
  static async createCategory(storeId, userId, userName, name, description) {
    const clean = name.trim();
    if (db.categories.some((c) => c.store_id === storeId && c.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`Category "${clean}" already exists`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const catPayload = {
      store_id: storeId,
      name: clean,
      description: description || "",
      active: true
    };
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createCategory(catPayload);
      db.categories.push(saved);
      AuditService.log({
        storeId,
        userId,
        userName,
        action: "CATEGORY_CREATED",
        entityType: "CATEGORY",
        entityId: saved.id,
        afterData: { name: saved.name }
      });
      return saved;
    }
    const cat = {
      id: crypto5.randomUUID(),
      ...catPayload,
      created_at: now,
      updated_at: now
    };
    db.categories.push(cat);
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "CATEGORY_CREATED",
      entityType: "CATEGORY",
      entityId: cat.id,
      afterData: { name: cat.name }
    });
    return cat;
  }
};

// server/services/inventoryService.ts
init_supabaseDb();
init_supabaseClient();
import crypto6 from "crypto";
var InventoryService = class {
  static receiveStock(params) {
    const qty = Number(params.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error("Received quantity must be a positive number");
    }
    const product = db.products.find((p) => p.id === params.productId && p.store_id === params.storeId);
    if (!product) throw new Error("Product not found");
    if (!product.active) throw new Error("Cannot receive stock for deactivated product");
    const beforeStock = product.current_stock;
    const afterStock = beforeStock + qty;
    product.current_stock = afterStock;
    product.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const unitCost = params.purchasePrice !== void 0 && Number(params.purchasePrice) >= 0 ? Number(params.purchasePrice) : product.purchase_price;
    const taxRate = params.taxRate !== void 0 && Number(params.taxRate) >= 0 ? Number(params.taxRate) : product.tax_rate;
    const taxType = params.taxType || product.purchase_tax_type || "EXCLUSIVE";
    let totalCost = qty * unitCost;
    let taxableAmount = totalCost;
    let taxAmount = 0;
    if (taxType === "INCLUSIVE" && taxRate > 0) {
      taxableAmount = Math.round(totalCost / (1 + taxRate / 100) * 100) / 100;
      taxAmount = Math.round((totalCost - taxableAmount) * 100) / 100;
    } else {
      taxableAmount = totalCost;
      taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
    }
    if (params.purchasePrice !== void 0 && Number(params.purchasePrice) > 0) {
      product.purchase_price = Number(params.purchasePrice);
      if (params.taxType) product.purchase_tax_type = params.taxType;
    }
    const reasonParts = [];
    if (params.reason) reasonParts.push(params.reason.trim());
    if (params.supplierInvoice) reasonParts.push(`Inv: ${params.supplierInvoice.trim()}`);
    if (params.supplierGstin) reasonParts.push(`GSTIN: ${params.supplierGstin.trim().toUpperCase()}`);
    if (taxRate > 0) reasonParts.push(`GST: ${taxRate}% (${taxType})`);
    const finalReason = reasonParts.join(" \xB7 ") || "Stock received from supplier";
    const movement = {
      id: crypto6.randomUUID(),
      store_id: params.storeId,
      product_id: product.id,
      product_name: product.name,
      user_id: params.userId,
      user_name: params.userName,
      type: "PURCHASE",
      quantity: qty,
      before_stock: beforeStock,
      after_stock: afterStock,
      reason: finalReason,
      purchase_cost: unitCost,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      supplier_invoice: params.supplierInvoice?.trim(),
      supplier_gstin: params.supplierGstin?.trim().toUpperCase(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.stock_movements.unshift(movement);
    if (isSupabaseConfigured) {
      SupabaseDb.updateProduct(product.id, {
        current_stock: afterStock,
        purchase_price: product.purchase_price,
        purchase_tax_type: product.purchase_tax_type,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).catch(() => {
      });
      SupabaseDb.createStockMovement(movement).catch(() => {
      });
    }
    AuditService.log({
      storeId: params.storeId,
      userId: params.userId,
      userName: params.userName,
      action: "STOCK_RECEIVED",
      entityType: "INVENTORY",
      entityId: product.id,
      afterData: {
        product: product.name,
        quantityReceived: qty,
        unitCost,
        taxRate,
        taxAmount,
        beforeStock,
        afterStock,
        supplierInvoice: params.supplierInvoice,
        reason: movement.reason
      }
    });
    db.save();
    return { product, movement };
  }
  static adjustStock(params) {
    const diff = Number(params.quantityDifference);
    if (isNaN(diff) || diff === 0) {
      throw new Error("Adjustment quantity difference cannot be zero");
    }
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error("Adjustment reason is strictly required for audit trails");
    }
    const product = db.products.find((p) => p.id === params.productId && p.store_id === params.storeId);
    if (!product) throw new Error("Product not found");
    const beforeStock = product.current_stock;
    const afterStock = beforeStock + diff;
    if (afterStock < 0) {
      throw new Error(`Insufficient stock. Current stock is ${beforeStock}, cannot deduct ${Math.abs(diff)}.`);
    }
    product.current_stock = afterStock;
    product.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const movementType = params.type || (diff < 0 ? "DAMAGE" : "ADJUSTMENT");
    const movement = {
      id: crypto6.randomUUID(),
      store_id: params.storeId,
      product_id: product.id,
      product_name: product.name,
      user_id: params.userId,
      user_name: params.userName,
      type: movementType,
      quantity: diff,
      before_stock: beforeStock,
      after_stock: afterStock,
      reason: params.reason.trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.stock_movements.unshift(movement);
    if (isSupabaseConfigured) {
      SupabaseDb.updateProduct(product.id, {
        current_stock: afterStock,
        updated_at: product.updated_at
      }).catch(() => {
      });
      SupabaseDb.createStockMovement(movement).catch(() => {
      });
    }
    AuditService.log({
      storeId: params.storeId,
      userId: params.userId,
      userName: params.userName,
      action: "STOCK_ADJUSTED",
      entityType: "INVENTORY",
      entityId: product.id,
      afterData: {
        product: product.name,
        type: movementType,
        quantityDifference: diff,
        beforeStock,
        afterStock,
        reason: movement.reason
      }
    });
    db.save();
    return { product, movement };
  }
  static getMovements(storeId, options) {
    let list = db.stock_movements.filter((m) => m.store_id === storeId);
    if (options?.productId) {
      list = list.filter((m) => m.product_id === options.productId);
    }
    if (options?.type) {
      list = list.filter((m) => m.type === options.type);
    }
    const limit = options?.limit || 100;
    return list.slice(0, limit);
  }
};

// server/services/billingService.ts
init_supabaseDb();
init_supabaseClient();
import crypto7 from "crypto";
function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
var BillingService = class {
  static async createSale(params) {
    const { storeId, userId, userName, payload } = params;
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("Sale must contain at least one item");
    }
    const validPaymentMethods = ["CASH", "UPI", "CARD", "OTHER"];
    if (!validPaymentMethods.includes(payload.paymentMethod)) {
      throw new Error("Invalid payment method");
    }
    const gstType = payload.gstType || "INTRA_STATE";
    const globalTaxMode = payload.taxMode;
    const itemMap = /* @__PURE__ */ new Map();
    const itemTaxTypeMap = /* @__PURE__ */ new Map();
    for (const item of payload.items) {
      const q = Number(item.quantity);
      if (isNaN(q) || q <= 0) throw new Error("All item quantities must be greater than zero");
      itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + q);
      if (item.taxType) itemTaxTypeMap.set(item.productId, item.taxType);
    }
    const verifiedProducts = [];
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    for (const [productId, qty] of itemMap.entries()) {
      const product = db.products.find((p) => p.id === productId && p.store_id === storeId);
      if (!product) throw new Error(`Product not found with ID ${productId}`);
      if (!product.active) throw new Error(`Product "${product.name}" is deactivated and cannot be sold`);
      if (product.current_stock < qty) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.current_stock}, requested: ${qty}`);
      }
      const unitPrice = round2(product.selling_price);
      let taxRate = round2(product.tax_rate || 0);
      if (gstType === "EXEMPT") taxRate = 0;
      const chosenTaxType = itemTaxTypeMap.get(productId) || (globalTaxMode && globalTaxMode !== "AUTO" ? globalTaxMode : product.tax_type) || "EXCLUSIVE";
      let lineSubtotal, lineTax, lineTotal;
      if (chosenTaxType === "INCLUSIVE" && taxRate > 0) {
        lineTotal = round2(qty * unitPrice);
        lineSubtotal = round2(lineTotal / (1 + taxRate / 100));
        lineTax = round2(lineTotal - lineSubtotal);
      } else {
        lineSubtotal = round2(qty * unitPrice);
        lineTax = round2(lineSubtotal * (taxRate / 100));
        lineTotal = round2(lineSubtotal + lineTax);
      }
      let itemCGST = 0, itemSGST = 0, itemIGST = 0;
      if (gstType === "INTER_STATE") {
        itemIGST = lineTax;
      } else if (gstType === "INTRA_STATE") {
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
    let appliedDiscount = round2(Math.max(0, Number(payload.discount) || 0));
    if (appliedDiscount > calculatedSubtotal + calculatedTax) {
      throw new Error("Discount cannot exceed the total bill amount");
    }
    const netBeforeRound = calculatedSubtotal + calculatedTax - appliedDiscount;
    const roundedTotal = Math.round(netBeforeRound);
    const roundOff = round2(roundedTotal - netBeforeRound);
    const billNumber = await db.getNextBillNumberAsync(storeId);
    const verificationToken = crypto7.randomUUID();
    const saleId = crypto7.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const saleItems = [];
    const stockMovements = [];
    for (const vp of verifiedProducts) {
      const { product, quantity, unitPrice, taxRate, lineSubtotal, lineTax, lineTotal, cgst, sgst, igst } = vp;
      const beforeStock = product.current_stock;
      const afterStock = beforeStock - quantity;
      product.current_stock = afterStock;
      product.updated_at = now;
      saleItems.push({
        id: crypto7.randomUUID(),
        sale_id: saleId,
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        barcode_snapshot: product.barcode,
        hsn_snapshot: product.hsn_code || "",
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
        created_at: now
      });
      stockMovements.push({
        store_id: storeId,
        product_id: product.id,
        product_name: product.name,
        user_id: userId,
        user_name: userName,
        type: "SALE",
        quantity: -quantity,
        before_stock: beforeStock,
        after_stock: afterStock,
        reason: `Sold on bill #${billNumber}`,
        reference_type: "SALE",
        reference_id: saleId
      });
    }
    const newSale = {
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
      customer_name: payload.customerName?.trim() || void 0,
      customer_phone: payload.customerPhone?.trim() || void 0,
      customer_gstin: payload.customerGstin?.trim().toUpperCase() || void 0,
      total: roundedTotal,
      payment_method: payload.paymentMethod,
      status: "COMPLETED",
      notes: payload.notes?.trim() || void 0,
      created_at: now,
      items: saleItems
    };
    if (isSupabaseConfigured) {
      const { supabase: supabase2 } = await Promise.resolve().then(() => (init_supabaseClient(), supabaseClient_exports));
      if (supabase2) {
        await Promise.all(
          verifiedProducts.map(
            (vp) => SupabaseDb.updateProduct(vp.product.id, {
              current_stock: vp.product.current_stock,
              updated_at: now
            }).catch(() => {
            })
          )
        );
      }
      const saved = await SupabaseDb.createSale(
        { ...newSale, items: void 0 },
        saleItems.map(({ id, sale_id, created_at, ...rest }) => rest)
      );
      await Promise.all(
        stockMovements.map((m) => SupabaseDb.createStockMovement(m).catch(() => {
        }))
      );
      db.sales.unshift(saved);
      db.sale_items.push(...saleItems);
      db.stock_movements.unshift(...stockMovements);
    } else {
      db.sales.unshift(newSale);
      db.sale_items.push(...saleItems);
      db.stock_movements.unshift(...stockMovements);
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "SALE_CREATED",
      entityType: "SALE",
      entityId: newSale.id,
      afterData: { billNumber: newSale.bill_number, total: newSale.total, paymentMethod: newSale.payment_method, itemCount: saleItems.length }
    });
    return { ...newSale, items: saleItems };
  }
  static async voidSale(params) {
    const { storeId, userId, userName, saleId, reason } = params;
    if (!reason || reason.trim().length === 0) throw new Error("A reason is mandatory for voiding a bill");
    const sale = db.sales.find((s) => s.id === saleId && s.store_id === storeId);
    if (!sale) throw new Error("Sale record not found");
    if (sale.status === "VOIDED") throw new Error("This bill is already voided");
    const saleItemsForSale = db.sale_items.filter((si) => si.sale_id === sale.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const stockRestores = [];
    for (const item of saleItemsForSale) {
      const product = db.products.find((p) => p.id === item.product_id && p.store_id === storeId);
      if (product) {
        const beforeStock = product.current_stock;
        const afterStock = beforeStock + item.quantity;
        product.current_stock = afterStock;
        product.updated_at = now;
        stockRestores.push({ productId: product.id, newStock: afterStock });
        const voidMov = {
          store_id: storeId,
          product_id: product.id,
          product_name: product.name,
          user_id: userId,
          user_name: userName,
          type: "VOID",
          quantity: item.quantity,
          before_stock: beforeStock,
          after_stock: afterStock,
          reason: `Stock restored from voided bill #${sale.bill_number}: ${reason.trim()}`,
          reference_type: "SALE_VOID",
          reference_id: sale.id
        };
        if (isSupabaseConfigured) {
          SupabaseDb.createStockMovement(voidMov).catch(() => {
          });
          SupabaseDb.updateProduct(product.id, { current_stock: afterStock, updated_at: now }).catch(() => {
          });
        }
        db.stock_movements.unshift(voidMov);
      }
    }
    sale.status = "VOIDED";
    sale.voided_at = now;
    sale.voided_by = userId;
    sale.voided_by_name = userName;
    sale.void_reason = reason.trim();
    if (isSupabaseConfigured) {
      await SupabaseDb.voidSale(saleId, userId, userName, reason.trim());
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "SALE_VOIDED",
      entityType: "SALE",
      entityId: sale.id,
      afterData: { billNumber: sale.bill_number, voidReason: sale.void_reason, voidedAt: sale.voided_at }
    });
    return sale;
  }
  static getSales(storeId, options) {
    let list = db.sales.filter((s) => s.store_id === storeId);
    if (options?.employeeId) list = list.filter((s) => s.employee_id === options.employeeId);
    if (options?.paymentMethod) list = list.filter((s) => s.payment_method === options.paymentMethod);
    if (options?.status) list = list.filter((s) => s.status === options.status);
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(
        (s) => s.bill_number.toLowerCase().includes(q) || s.employee_name.toLowerCase().includes(q) || s.notes && s.notes.toLowerCase().includes(q)
      );
    }
    if (options?.from) {
      const fromDate = new Date(options.from).getTime();
      list = list.filter((s) => new Date(s.created_at).getTime() >= fromDate);
    }
    if (options?.to) {
      const toDate = new Date(options.to).getTime() + 864e5;
      list = list.filter((s) => new Date(s.created_at).getTime() <= toDate);
    }
    const limit = options?.limit || 200;
    return list.slice(0, limit).map((s) => ({
      ...s,
      items: db.sale_items.filter((si) => si.sale_id === s.id)
    }));
  }
  static getSaleById(storeId, saleId) {
    const sale = db.sales.find((s) => s.id === saleId && s.store_id === storeId);
    if (!sale) throw new Error("Sale not found");
    const items = db.sale_items.filter((si) => si.sale_id === sale.id);
    return { ...sale, items };
  }
};

// server/services/employeeService.ts
init_supabaseDb();
init_supabaseClient();
import crypto8 from "crypto";
var EmployeeService = class {
  static listEmployees(storeId) {
    return db.users.filter((u) => u.store_id === storeId).map((u) => safeUser(u));
  }
  static async createEmployee(storeId, adminUserId, adminUserName, payload) {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim();
    if (!cleanName) throw new Error("Employee name is required");
    if (!cleanEmail) throw new Error("Employee email is required");
    if (!payload.password || payload.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }
    if (isSupabaseConfigured) {
      const existing = await SupabaseDb.getUserByEmail(cleanEmail);
      if (existing) {
        throw new Error(`An employee with email "${cleanEmail}" already exists`);
      }
    } else {
      const existing = db.users.find((u) => u.store_id === storeId && u.email.toLowerCase() === cleanEmail);
      if (existing) throw new Error(`An employee with email "${cleanEmail}" already exists`);
    }
    const salt = generateSalt();
    const passwordHash = hashPassword(payload.password, salt);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newEmp = {
      id: crypto8.randomUUID(),
      store_id: storeId,
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      salt,
      role: payload.role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      active: true,
      created_by: adminUserId || void 0,
      created_at: now,
      updated_at: now
    };
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createUser(newEmp);
      db.users.push(saved);
      AuditService.log({
        storeId,
        userId: adminUserId,
        userName: adminUserName,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: saved.id,
        afterData: { name: saved.name, email: saved.email, role: saved.role }
      });
      return safeUser(saved);
    }
    db.users.push(newEmp);
    AuditService.log({
      storeId,
      userId: adminUserId,
      userName: adminUserName,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: newEmp.id,
      afterData: { name: newEmp.name, email: newEmp.email, role: newEmp.role }
    });
    return safeUser(newEmp);
  }
  static async setEmployeeActive(storeId, adminUserId, adminUserName, employeeId, active) {
    if (adminUserId === employeeId) {
      throw new Error("You cannot deactivate your own admin account");
    }
    const user = db.users.find((u) => u.id === employeeId && u.store_id === storeId);
    if (!user) throw new Error("User not found");
    const beforeActive = user.active;
    user.active = active;
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(employeeId, { active, updated_at: user.updated_at });
    }
    AuditService.log({
      storeId,
      userId: adminUserId,
      userName: adminUserName,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "USER",
      entityId: user.id,
      beforeData: { active: beforeActive },
      afterData: { active }
    });
    return safeUser(user);
  }
  static async resetEmployeePassword(storeId, adminUserId, adminUserName, employeeId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }
    const user = db.users.find((u) => u.id === employeeId && u.store_id === storeId);
    if (!user) throw new Error("User not found");
    const salt = generateSalt();
    const passwordHash = hashPassword(newPassword, salt);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    user.password_hash = passwordHash;
    user.salt = salt;
    user.updated_at = now;
    if (isSupabaseConfigured) {
      await SupabaseDb.updateUser(employeeId, { password_hash: passwordHash, salt, updated_at: now });
    }
    AuditService.log({
      storeId,
      userId: adminUserId,
      userName: adminUserName,
      action: "USER_PASSWORD_RESET",
      entityType: "USER",
      entityId: user.id
    });
    return safeUser(user);
  }
};
var ExpenseService = class {
  static listExpenses(storeId, options) {
    let list = db.expenses.filter((e) => e.store_id === storeId);
    if (options?.from) list = list.filter((e) => e.expense_date >= options.from);
    if (options?.to) list = list.filter((e) => e.expense_date <= options.to);
    return list;
  }
  static async createExpense(storeId, userId, userName, payload) {
    const amt = Number(payload.amount);
    if (isNaN(amt) || amt <= 0) throw new Error("Expense amount must be greater than zero");
    if (!payload.category?.trim()) throw new Error("Expense category is required");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expDate = payload.expenseDate || now.split("T")[0];
    const newExp = {
      store_id: storeId,
      created_by: userId,
      created_by_name: userName,
      category: payload.category.trim(),
      amount: amt,
      description: payload.description?.trim() || "",
      expense_date: expDate,
      status: "ACTIVE"
    };
    if (isSupabaseConfigured) {
      const saved = await SupabaseDb.createExpense(newExp);
      db.expenses.unshift(saved);
      AuditService.log({
        storeId,
        userId,
        userName,
        action: "EXPENSE_CREATED",
        entityType: "EXPENSE",
        entityId: saved.id,
        afterData: { category: saved.category, amount: saved.amount, date: saved.expense_date }
      });
      return saved;
    }
    const local = { ...newExp, id: crypto8.randomUUID(), created_at: now };
    db.expenses.unshift(local);
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "EXPENSE_CREATED",
      entityType: "EXPENSE",
      entityId: local.id,
      afterData: { category: local.category, amount: local.amount, date: local.expense_date }
    });
    return local;
  }
  static async voidExpense(storeId, userId, userName, expenseId) {
    const exp = db.expenses.find((e) => e.id === expenseId && e.store_id === storeId);
    if (!exp) throw new Error("Expense record not found");
    if (exp.status === "VOIDED") throw new Error("Expense is already voided");
    exp.status = "VOIDED";
    if (isSupabaseConfigured) {
      await SupabaseDb.voidExpense(expenseId);
    }
    AuditService.log({
      storeId,
      userId,
      userName,
      action: "EXPENSE_VOIDED",
      entityType: "EXPENSE",
      entityId: exp.id,
      afterData: { category: exp.category, amount: exp.amount, status: "VOIDED" }
    });
    return exp;
  }
};

// server/services/verificationService.ts
var VerificationService = class {
  static verifyBill(token) {
    if (!token || typeof token !== "string") {
      return {
        valid: false,
        error: "Invalid or missing verification token"
      };
    }
    const cleanToken = token.trim();
    const sale = db.sales.find((s) => s.verification_token === cleanToken);
    if (!sale) {
      return {
        valid: false,
        error: "No bill found matching this verification token. The bill may be counterfeit or invalid."
      };
    }
    const store = db.stores.find((s) => s.id === sale.store_id);
    const items = db.sale_items.filter((si) => si.sale_id === sale.id);
    return {
      valid: true,
      store: {
        name: store?.name || "Retail Store",
        address: store?.address || "",
        gstin: store?.gstin || "",
        phone: store?.phone || "",
        email: store?.email || ""
      },
      bill: {
        billNumber: sale.bill_number,
        date: sale.created_at,
        status: sale.status,
        // COMPLETED, VOIDED, REFUNDED
        items: items.map((i) => ({
          name: i.product_name_snapshot,
          hsn: i.hsn_snapshot,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          taxRate: i.tax_rate,
          taxAmount: i.tax_amount,
          cgstAmount: i.cgst_amount,
          sgstAmount: i.sgst_amount,
          lineTotal: i.line_total
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        cgst: sale.cgst ?? Math.round(sale.tax / 2 * 100) / 100,
        sgst: sale.sgst ?? Math.round(sale.tax / 2 * 100) / 100,
        igst: sale.igst,
        gstType: sale.gst_type,
        roundOff: sale.round_off,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        customerGstin: sale.customer_gstin,
        total: sale.total,
        paymentMethod: sale.payment_method,
        paymentStatus: sale.status === "COMPLETED" ? "PAID" : sale.status,
        voidReason: sale.status === "VOIDED" ? sale.void_reason : void 0,
        voidedAt: sale.status === "VOIDED" ? sale.voided_at : void 0
      }
    };
  }
};

// server/services/dashboardService.ts
function round22(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
var DashboardService = class {
  static getSummary(storeId) {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const currentMonthStr = todayStr.substring(0, 7);
    const validSales = db.sales.filter((s) => s.store_id === storeId && s.status === "COMPLETED");
    const validSaleIds = new Set(validSales.map((s) => s.id));
    const validSaleItems = db.sale_items.filter((si) => validSaleIds.has(si.sale_id));
    const saleDateMap = new Map(validSales.map((s) => [s.id, s.created_at]));
    const todaySalesList = validSales.filter((s) => s.created_at.startsWith(todayStr));
    const todayRevenue = round22(todaySalesList.reduce((sum, s) => sum + s.total, 0));
    const todayBillsCount = todaySalesList.length;
    const todaySaleItemIds = new Set(todaySalesList.map((s) => s.id));
    const todayItems = validSaleItems.filter((si) => todaySaleItemIds.has(si.sale_id));
    const todayCOGS = round22(todayItems.reduce((sum, i) => sum + i.quantity * (i.purchase_price_snapshot || 0), 0));
    const todayGrossProfit = round22(todayRevenue - todayCOGS);
    const activeExpenses = db.expenses.filter((e) => e.store_id === storeId && e.status === "ACTIVE");
    const todayExpensesList = activeExpenses.filter((e) => e.expense_date === todayStr);
    const todayExpenses = round22(todayExpensesList.reduce((sum, e) => sum + e.amount, 0));
    const todayNetProfit = round22(todayGrossProfit - todayExpenses);
    const monthSalesList = validSales.filter((s) => s.created_at.startsWith(currentMonthStr));
    const monthRevenue = round22(monthSalesList.reduce((sum, s) => sum + s.total, 0));
    const monthSaleIds = new Set(monthSalesList.map((s) => s.id));
    const monthItems = validSaleItems.filter((si) => monthSaleIds.has(si.sale_id));
    const monthCOGS = round22(monthItems.reduce((sum, i) => sum + i.quantity * (i.purchase_price_snapshot || 0), 0));
    const monthGrossProfit = round22(monthRevenue - monthCOGS);
    const monthExpensesList = activeExpenses.filter((e) => e.expense_date.startsWith(currentMonthStr));
    const monthExpenses = round22(monthExpensesList.reduce((sum, e) => sum + e.amount, 0));
    const monthNetProfit = round22(monthGrossProfit - monthExpenses);
    const products = db.products.filter((p) => p.store_id === storeId && p.active);
    const lowStockCount = products.filter((p) => p.current_stock <= p.minimum_stock && p.current_stock > 0).length;
    const outOfStockCount = products.filter((p) => p.current_stock <= 0).length;
    const totalProductsCount = products.length;
    const paymentMap = {
      CASH: { count: 0, total: 0 },
      UPI: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
      OTHER: { count: 0, total: 0 }
    };
    validSales.forEach((s) => {
      if (paymentMap[s.payment_method]) {
        paymentMap[s.payment_method].count += 1;
        paymentMap[s.payment_method].total = round22(paymentMap[s.payment_method].total + s.total);
      }
    });
    const productStats = /* @__PURE__ */ new Map();
    validSaleItems.forEach((item) => {
      const existing = productStats.get(item.product_id) || {
        name: item.product_name_snapshot,
        quantity: 0,
        revenue: 0
      };
      existing.quantity += item.quantity;
      existing.revenue = round22(existing.revenue + item.line_total);
      productStats.set(item.product_id, existing);
    });
    const topProducts = Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const daySales = validSales.filter((s) => s.created_at.startsWith(dayStr));
      const total = round22(daySales.reduce((sum, s) => sum + s.total, 0));
      last7Days.push({
        date: dayStr,
        label: dayLabel,
        sales: total,
        bills: daySales.length
      });
    }
    const recentBills = db.sales.filter((s) => s.store_id === storeId).slice(0, 6).map((s) => ({
      id: s.id,
      billNumber: s.bill_number,
      total: s.total,
      status: s.status,
      paymentMethod: s.payment_method,
      employeeName: s.employee_name,
      createdAt: s.created_at,
      itemCount: db.sale_items.filter((si) => si.sale_id === s.id).length
    }));
    const lowStockItems = products.filter((p) => p.current_stock <= p.minimum_stock).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.current_stock,
      minimumStock: p.minimum_stock,
      unit: p.unit,
      isOut: p.current_stock <= 0
    })).slice(0, 6);
    return {
      today: {
        revenue: todayRevenue,
        cogs: todayCOGS,
        grossProfit: todayGrossProfit,
        expenses: todayExpenses,
        netProfit: todayNetProfit,
        billsCount: todayBillsCount
      },
      month: {
        revenue: monthRevenue,
        cogs: monthCOGS,
        grossProfit: monthGrossProfit,
        expenses: monthExpenses,
        netProfit: monthNetProfit
      },
      inventory: {
        lowStockCount,
        outOfStockCount,
        totalProductsCount,
        lowStockItems
      },
      paymentBreakdown: paymentMap,
      topProducts,
      salesChart: last7Days,
      recentBills
    };
  }
};

// server/services/reportService.ts
function round23(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
var ReportService = class {
  static getSalesReport(storeId, options) {
    let sales = db.sales.filter((s) => s.store_id === storeId);
    if (options?.from) {
      sales = sales.filter((s) => s.created_at >= options.from);
    }
    if (options?.to) {
      sales = sales.filter((s) => s.created_at <= options.to + "T23:59:59.999Z");
    }
    if (options?.employeeId) {
      sales = sales.filter((s) => s.employee_id === options.employeeId);
    }
    if (options?.paymentMethod) {
      sales = sales.filter((s) => s.payment_method === options.paymentMethod);
    }
    if (options?.status) {
      sales = sales.filter((s) => s.status === options.status);
    }
    const reportRows = sales.map((s) => {
      const items = db.sale_items.filter((si) => si.sale_id === s.id);
      const cogs = round23(items.reduce((sum, i) => sum + i.quantity * (i.purchase_price_snapshot || 0), 0));
      return {
        id: s.id,
        billNumber: s.bill_number,
        date: s.created_at,
        cashier: s.employee_name,
        subtotal: s.subtotal,
        discount: s.discount,
        tax: s.tax,
        total: s.total,
        cogs,
        grossMargin: s.status === "COMPLETED" ? round23(s.total - cogs) : 0,
        paymentMethod: s.payment_method,
        status: s.status,
        itemCount: items.length
      };
    });
    const totalRevenue = round23(reportRows.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.total, 0));
    const totalTax = round23(reportRows.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.tax, 0));
    const totalDiscount = round23(reportRows.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.discount, 0));
    return {
      rows: reportRows,
      summary: {
        totalRevenue,
        totalTax,
        totalDiscount,
        totalBills: reportRows.length,
        completedBills: reportRows.filter((r) => r.status === "COMPLETED").length,
        voidedBills: reportRows.filter((r) => r.status === "VOIDED").length
      }
    };
  }
  static getInventoryReport(storeId) {
    const products = db.products.filter((p) => p.store_id === storeId);
    const categoriesMap = new Map(db.categories.map((c) => [c.id, c.name]));
    let totalPurchaseValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const rows = products.map((p) => {
      const purchaseVal = round23(p.current_stock * p.purchase_price);
      const retailVal = round23(p.current_stock * p.selling_price);
      totalPurchaseValuation = round23(totalPurchaseValuation + purchaseVal);
      totalRetailValuation = round23(totalRetailValuation + retailVal);
      let status = "IN_STOCK";
      if (p.current_stock <= 0) {
        status = "OUT_OF_STOCK";
        outOfStockCount++;
      } else if (p.current_stock <= p.minimum_stock) {
        status = "LOW_STOCK";
        lowStockCount++;
      }
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category_id ? categoriesMap.get(p.category_id) || "Uncategorized" : "Uncategorized",
        currentStock: p.current_stock,
        minimumStock: p.minimum_stock,
        unit: p.unit,
        purchasePrice: p.purchase_price,
        sellingPrice: p.selling_price,
        purchaseValuation: purchaseVal,
        retailValuation: retailVal,
        status,
        active: p.active
      };
    });
    return {
      rows,
      summary: {
        totalProducts: products.length,
        totalPurchaseValuation,
        totalRetailValuation,
        estimatedGrossProfitPotential: round23(totalRetailValuation - totalPurchaseValuation),
        lowStockCount,
        outOfStockCount
      }
    };
  }
  static getProfitReport(storeId, options) {
    const salesReport = this.getSalesReport(storeId, { from: options?.from, to: options?.to, status: "COMPLETED" });
    const revenue = salesReport.summary.totalRevenue;
    const totalCOGS = round23(salesReport.rows.reduce((sum, r) => sum + r.cogs, 0));
    const grossProfit = round23(revenue - totalCOGS);
    const grossMarginPercent = revenue > 0 ? round23(grossProfit / revenue * 100) : 0;
    let expenses = db.expenses.filter((e) => e.store_id === storeId && e.status === "ACTIVE");
    if (options?.from) expenses = expenses.filter((e) => e.expense_date >= options.from);
    if (options?.to) expenses = expenses.filter((e) => e.expense_date <= options.to);
    const totalExpenses = round23(expenses.reduce((sum, e) => sum + e.amount, 0));
    const netProfit = round23(grossProfit - totalExpenses);
    const netMarginPercent = revenue > 0 ? round23(netProfit / revenue * 100) : 0;
    return {
      summary: {
        revenue,
        cogs: totalCOGS,
        grossProfit,
        grossMarginPercent,
        totalExpenses,
        netProfit,
        netMarginPercent,
        billsCount: salesReport.summary.completedBills
      }
    };
  }
  static getEmployeeReport(storeId, options) {
    const employees = db.users.filter((u) => u.store_id === storeId);
    let sales = db.sales.filter((s) => s.store_id === storeId && s.status === "COMPLETED");
    if (options?.from) sales = sales.filter((s) => s.created_at >= options.from);
    if (options?.to) sales = sales.filter((s) => s.created_at <= options.to + "T23:59:59.999Z");
    const empMap = /* @__PURE__ */ new Map();
    employees.forEach((emp) => {
      empMap.set(emp.id, {
        employeeName: emp.name,
        email: emp.email,
        role: emp.role,
        billsCount: 0,
        totalSales: 0,
        itemsSold: 0
      });
    });
    sales.forEach((s) => {
      const entry = empMap.get(s.employee_id);
      if (entry) {
        entry.billsCount += 1;
        entry.totalSales = round23(entry.totalSales + s.total);
        const items = db.sale_items.filter((si) => si.sale_id === s.id);
        entry.itemsSold += items.reduce((sum, i) => sum + i.quantity, 0);
      }
    });
    return Array.from(empMap.values());
  }
};

// server.ts
init_supabaseClient();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json());
app.use(cookieParser());
var requireAuth = (req, res, next) => {
  const token = req.cookies?.session_token || req.headers["x-session-token"];
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  }
  const sessionData = AuthService.getSession(token);
  if (!sessionData) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session expired or invalid" } });
  }
  req.user = sessionData.user;
  req.store = sessionData.store;
  next();
};
var requireAdmin = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin privileges required" } });
  }
  next();
};
app.get("/api/qr", async (req, res) => {
  try {
    const text = req.query.text;
    if (!text) {
      return res.status(400).send("Text parameter is required");
    }
    const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 256 });
    res.json({ dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/verify/:token", (req, res) => {
  try {
    const result = VerificationService.verifyBill(req.params.token);
    res.json(result);
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required" } });
    }
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const result = await AuthService.login(email, password, ip, userAgent);
    res.cookie("session_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1e3
    });
    res.json({
      token: result.token,
      user: result.user,
      store: result.store
    });
  } catch (err) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: err.message } });
  }
});
app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.session_token || req.headers["x-session-token"];
  if (token) {
    AuthService.logout(token);
  }
  res.clearCookie("session_token");
  res.json({ success: true });
});
app.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({
    user: req.user,
    store: req.store
  });
});
app.get("/api/products", requireAuth, (req, res) => {
  try {
    const { search, barcode, categoryId, lowStock, outOfStock, activeOnly } = req.query;
    const products = ProductService.listProducts(req.user.store_id, {
      search,
      barcode,
      categoryId,
      lowStock: lowStock === "true",
      outOfStock: outOfStock === "true",
      activeOnly: activeOnly !== "false"
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
app.get("/api/products/:id", requireAuth, (req, res) => {
  try {
    const product = ProductService.getProduct(req.user.store_id, req.params.id);
    res.json(product);
  } catch (err) {
    res.status(404).json({ error: { message: err.message } });
  }
});
app.post("/api/products", requireAuth, async (req, res) => {
  try {
    const product = await ProductService.createProduct(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.body
    );
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.patch("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const updated = await ProductService.updateProduct(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.params.id,
      req.body
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/products/:id/activate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await ProductService.toggleActive(req.user.store_id, req.user.id, req.user.name, req.params.id, true);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/products/:id/deactivate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await ProductService.toggleActive(req.user.store_id, req.user.id, req.user.name, req.params.id, false);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.get("/api/categories", requireAuth, (req, res) => {
  const categories = CategoryService.listCategories(req.user.store_id);
  res.json(categories);
});
app.post("/api/categories", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: { message: "Category name is required" } });
    const cat = await CategoryService.createCategory(req.user.store_id, req.user.id, req.user.name, name, description);
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.get("/api/inventory/movements", requireAuth, (req, res) => {
  try {
    const { productId, type, limit } = req.query;
    const movements = InventoryService.getMovements(req.user.store_id, {
      productId,
      type,
      limit: limit ? Number(limit) : 100
    });
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
app.post("/api/inventory/receive", requireAuth, (req, res) => {
  try {
    const { productId, quantity, reason, purchasePrice, taxRate, taxType, supplierInvoice, supplierGstin } = req.body;
    const result = InventoryService.receiveStock({
      storeId: req.user.store_id,
      userId: req.user.id,
      userName: req.user.name,
      productId,
      quantity,
      reason,
      purchasePrice,
      taxRate,
      taxType,
      supplierInvoice,
      supplierGstin
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/inventory/adjust", requireAuth, (req, res) => {
  try {
    const { productId, quantityDifference, reason, type } = req.body;
    const result = InventoryService.adjustStock({
      storeId: req.user.store_id,
      userId: req.user.id,
      userName: req.user.name,
      productId,
      quantityDifference,
      reason,
      type
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/sales", requireAuth, async (req, res) => {
  try {
    const sale = await BillingService.createSale({
      storeId: req.user.store_id,
      userId: req.user.id,
      userName: req.user.name,
      payload: req.body
    });
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: { code: "SALE_FAILED", message: err.message } });
  }
});
app.get("/api/sales", requireAuth, (req, res) => {
  try {
    const { search, from, to, employeeId, paymentMethod, status, limit } = req.query;
    const filterEmployeeId = req.user.role === "EMPLOYEE" ? req.user.id : employeeId;
    const sales = BillingService.getSales(req.user.store_id, {
      search,
      from,
      to,
      employeeId: filterEmployeeId,
      paymentMethod,
      status,
      limit: limit ? Number(limit) : 100
    });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
app.get("/api/sales/:id", requireAuth, (req, res) => {
  try {
    const sale = BillingService.getSaleById(req.user.store_id, req.params.id);
    res.json(sale);
  } catch (err) {
    res.status(404).json({ error: { message: err.message } });
  }
});
app.post("/api/sales/:id/void", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const voided = await BillingService.voidSale({
      storeId: req.user.store_id,
      userId: req.user.id,
      userName: req.user.name,
      saleId: req.params.id,
      reason
    });
    res.json(voided);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.get("/api/employees", requireAuth, requireAdmin, (req, res) => {
  const employees = EmployeeService.listEmployees(req.user.store_id);
  res.json(employees);
});
app.post("/api/employees", requireAuth, requireAdmin, async (req, res) => {
  try {
    const emp = await EmployeeService.createEmployee(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.body
    );
    res.status(201).json(emp);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/employees/:id/activate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const emp = await EmployeeService.setEmployeeActive(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.params.id,
      true
    );
    res.json(emp);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/employees/:id/deactivate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const emp = await EmployeeService.setEmployeeActive(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.params.id,
      false
    );
    res.json(emp);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.get("/api/expenses", requireAuth, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const list = ExpenseService.listExpenses(req.user.store_id, {
    from,
    to
  });
  res.json(list);
});
app.post("/api/expenses", requireAuth, requireAdmin, async (req, res) => {
  try {
    const exp = await ExpenseService.createExpense(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.body
    );
    res.status(201).json(exp);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.post("/api/expenses/:id/void", requireAuth, requireAdmin, async (req, res) => {
  try {
    const exp = await ExpenseService.voidExpense(
      req.user.store_id,
      req.user.id,
      req.user.name,
      req.params.id
    );
    res.json(exp);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
app.get("/api/dashboard/summary", requireAuth, requireAdmin, (req, res) => {
  try {
    const summary = DashboardService.getSummary(req.user.store_id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
app.get("/api/reports/sales", requireAuth, requireAdmin, (req, res) => {
  const { from, to, employeeId, paymentMethod, status } = req.query;
  const rep = ReportService.getSalesReport(req.user.store_id, {
    from,
    to,
    employeeId,
    paymentMethod,
    status
  });
  res.json(rep);
});
app.get("/api/reports/inventory", requireAuth, requireAdmin, (req, res) => {
  const rep = ReportService.getInventoryReport(req.user.store_id);
  res.json(rep);
});
app.get("/api/reports/profit", requireAuth, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const rep = ReportService.getProfitReport(req.user.store_id, {
    from,
    to
  });
  res.json(rep);
});
app.get("/api/reports/employees", requireAuth, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const rep = ReportService.getEmployeeReport(req.user.store_id, {
    from,
    to
  });
  res.json(rep);
});
app.get("/api/audit-logs", requireAuth, requireAdmin, (req, res) => {
  const { action, entityType, limit } = req.query;
  const logs = AuditService.getLogs(req.user.store_id, {
    action,
    entityType,
    limit: limit ? Number(limit) : 100
  });
  res.json(logs);
});
app.get("/api/settings", requireAuth, (req, res) => {
  res.json(req.store);
});
app.patch("/api/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const store = db.stores.find((s) => s.id === req.user.store_id);
    if (!store) return res.status(404).json({ error: { message: "Store not found" } });
    const before = { ...store };
    const { name, address, phone, email, gstin, invoicePrefix } = req.body;
    if (name) store.name = name;
    if (address) store.address = address;
    if (phone) store.phone = phone;
    if (email) store.email = email;
    if (gstin) store.gstin = gstin;
    if (invoicePrefix) store.invoice_prefix = invoicePrefix;
    store.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (isSupabaseConfigured) {
      const { SupabaseDb: SupabaseDb2 } = await Promise.resolve().then(() => (init_supabaseDb(), supabaseDb_exports));
      await SupabaseDb2.updateStore(store.id, store).catch(() => {
      });
    }
    AuditService.log({
      storeId: store.id,
      userId: req.user.id,
      userName: req.user.name,
      action: "SETTINGS_UPDATED",
      entityType: "STORE",
      entityId: store.id,
      beforeData: before,
      afterData: { ...store }
    });
    res.json(store);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}
var server_default = app;
export {
  app,
  server_default as default
};
