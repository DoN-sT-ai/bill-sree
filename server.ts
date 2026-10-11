import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { db } from './server/db.ts';
import { AuthService } from './server/services/authService.ts';
import { ProductService, CategoryService } from './server/services/productService.ts';
import { InventoryService } from './server/services/inventoryService.ts';
import { BillingService } from './server/services/billingService.ts';
import { EmployeeService, ExpenseService } from './server/services/employeeService.ts';
import { VerificationService } from './server/services/verificationService.ts';
import { DashboardService } from './server/services/dashboardService.ts';
import { ReportService } from './server/services/reportService.ts';
import { AuditService } from './server/services/auditService.ts';
import { isSupabaseConfigured } from './server/supabaseClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Resilient body parsing: skip express.json() if body already parsed by Vercel serverless runtime
app.use((req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {}
  }
  if (req.body && typeof req.body === 'object') {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(cookieParser());

// Normalize incoming path for Vercel rewrites:
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url && req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace('/api/index.js', '/api');
  }
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.includes('.')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Diagnostic Health Check Route
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    isSupabaseConfigured,
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
    nodeEnv: process.env.NODE_ENV,
    isVercel: Boolean(process.env.VERCEL),
  });
});

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    store_id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'EMPLOYEE';
    active: boolean;
  };
  store?: any;
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = (req.cookies?.session_token as string) || (req.headers['x-session-token'] as string);
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  const sessionData = AuthService.getSession(token);
  if (!sessionData) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' } });
  }

  req.user = sessionData.user;
  req.store = sessionData.store;
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } });
  }
  next();
};

// ==========================================
// PUBLIC & VERIFICATION ROUTES
// ==========================================

// QR Code generator helper
app.get('/api/qr', async (req: Request, res: Response) => {
  try {
    const text = req.query.text as string;
    if (!text) {
      return res.status(400).send('Text parameter is required');
    }
    const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 256 });
    res.json({ dataUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public bill verification
app.get('/api/verify/:token', (req: Request, res: Response) => {
  try {
    const result = VerificationService.verifyBill(req.params.token);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await AuthService.login(email, password, ip, userAgent);

    res.cookie('session_token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token: result.token,
      user: result.user,
      store: result.store,
    });
  } catch (err: any) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
  }
});

app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  const token = (req.cookies?.session_token as string) || (req.headers['x-session-token'] as string);
  if (token) {
    AuthService.logout(token);
  }
  res.clearCookie('session_token');
  res.json({ success: true });
});

app.get('/api/auth/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
    store: req.store,
  });
});

// ==========================================
// PRODUCT & CATEGORY ROUTES
// ==========================================

app.get('/api/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, barcode, categoryId, lowStock, outOfStock, activeOnly } = req.query;
    const products = ProductService.listProducts(req.user!.store_id, {
      search: search as string,
      barcode: barcode as string,
      categoryId: categoryId as string,
      lowStock: lowStock === 'true',
      outOfStock: outOfStock === 'true',
      activeOnly: activeOnly !== 'false',
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = ProductService.getProduct(req.user!.store_id, req.params.id);
    res.json(product);
  } catch (err: any) {
    res.status(404).json({ error: { message: err.message } });
  }
});

app.post('/api/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await ProductService.createProduct(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.body
    );
    res.status(201).json(product);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.patch('/api/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await ProductService.updateProduct(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.params.id,
      req.body
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/products/:id/activate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await ProductService.toggleActive(req.user!.store_id, req.user!.id, req.user!.name, req.params.id, true);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/products/:id/deactivate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await ProductService.toggleActive(req.user!.store_id, req.user!.id, req.user!.name, req.params.id, false);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.get('/api/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const categories = CategoryService.listCategories(req.user!.store_id);
  res.json(categories);
});

app.post('/api/categories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: { message: 'Category name is required' } });
    const cat = await CategoryService.createCategory(req.user!.store_id, req.user!.id, req.user!.name, name, description);
    res.status(201).json(cat);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// INVENTORY ROUTES
// ==========================================

app.get('/api/inventory/movements', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, type, limit } = req.query;
    const movements = InventoryService.getMovements(req.user!.store_id, {
      productId: productId as string,
      type: type as any,
      limit: limit ? Number(limit) : 100,
    });
    res.json(movements);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/api/inventory/receive', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, quantity, reason, purchasePrice, taxRate, taxType, supplierInvoice, supplierGstin } = req.body;
    const result = InventoryService.receiveStock({
      storeId: req.user!.store_id,
      userId: req.user!.id,
      userName: req.user!.name,
      productId,
      quantity,
      reason,
      purchasePrice,
      taxRate,
      taxType,
      supplierInvoice,
      supplierGstin,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/inventory/adjust', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, quantityDifference, reason, type } = req.body;
    const result = InventoryService.adjustStock({
      storeId: req.user!.store_id,
      userId: req.user!.id,
      userName: req.user!.name,
      productId,
      quantityDifference,
      reason,
      type,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// BILLING / POS / SALES ROUTES
// ==========================================

app.post('/api/sales', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sale = await BillingService.createSale({
      storeId: req.user!.store_id,
      userId: req.user!.id,
      userName: req.user!.name,
      payload: req.body,
    });
    res.status(201).json(sale);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'SALE_FAILED', message: err.message } });
  }
});

app.get('/api/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, from, to, employeeId, paymentMethod, status, limit } = req.query;

    // Strict role check: If employee, only view own sales unless configured otherwise
    const filterEmployeeId = req.user!.role === 'EMPLOYEE' ? req.user!.id : (employeeId as string);

    const sales = BillingService.getSales(req.user!.store_id, {
      search: search as string,
      from: from as string,
      to: to as string,
      employeeId: filterEmployeeId,
      paymentMethod: paymentMethod as string,
      status: status as string,
      limit: limit ? Number(limit) : 100,
    });
    res.json(sales);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/sales/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sale = BillingService.getSaleById(req.user!.store_id, req.params.id);
    res.json(sale);
  } catch (err: any) {
    res.status(404).json({ error: { message: err.message } });
  }
});

app.post('/api/sales/:id/void', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const voided = await BillingService.voidSale({
      storeId: req.user!.store_id,
      userId: req.user!.id,
      userName: req.user!.name,
      saleId: req.params.id,
      reason,
    });
    res.json(voided);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// EMPLOYEE MANAGEMENT (ADMIN ONLY)
// ==========================================

app.get('/api/employees', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const employees = EmployeeService.listEmployees(req.user!.store_id);
  res.json(employees);
});

app.post('/api/employees', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await EmployeeService.createEmployee(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.body
    );
    res.status(201).json(emp);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/employees/:id/activate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await EmployeeService.setEmployeeActive(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.params.id,
      true
    );
    res.json(emp);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/employees/:id/deactivate', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emp = await EmployeeService.setEmployeeActive(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.params.id,
      false
    );
    res.json(emp);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// EXPENSES (ADMIN ONLY)
// ==========================================

app.get('/api/expenses', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = req.query;
  const list = ExpenseService.listExpenses(req.user!.store_id, {
    from: from as string,
    to: to as string,
  });
  res.json(list);
});

app.post('/api/expenses', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await ExpenseService.createExpense(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.body
    );
    res.status(201).json(exp);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/expenses/:id/void', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exp = await ExpenseService.voidExpense(
      req.user!.store_id,
      req.user!.id,
      req.user!.name,
      req.params.id
    );
    res.json(exp);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// DASHBOARD & REPORTS (ADMIN ONLY)
// ==========================================

app.get('/api/dashboard/summary', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = DashboardService.getSummary(req.user!.store_id);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/reports/sales', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { from, to, employeeId, paymentMethod, status } = req.query;
  const rep = ReportService.getSalesReport(req.user!.store_id, {
    from: from as string,
    to: to as string,
    employeeId: employeeId as string,
    paymentMethod: paymentMethod as string,
    status: status as string,
  });
  res.json(rep);
});

app.get('/api/reports/inventory', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const rep = ReportService.getInventoryReport(req.user!.store_id);
  res.json(rep);
});

app.get('/api/reports/profit', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = req.query;
  const rep = ReportService.getProfitReport(req.user!.store_id, {
    from: from as string,
    to: to as string,
  });
  res.json(rep);
});

app.get('/api/reports/employees', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = req.query;
  const rep = ReportService.getEmployeeReport(req.user!.store_id, {
    from: from as string,
    to: to as string,
  });
  res.json(rep);
});

// ==========================================
// AUDIT LOGS (ADMIN ONLY)
// ==========================================

app.get('/api/audit-logs', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { action, entityType, limit } = req.query;
  const logs = AuditService.getLogs(req.user!.store_id, {
    action: action as string,
    entityType: entityType as string,
    limit: limit ? Number(limit) : 100,
  });
  res.json(logs);
});

// ==========================================
// STORE SETTINGS
// ==========================================

app.get('/api/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.store);
});

app.patch('/api/settings', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const store = db.stores.find(s => s.id === req.user!.store_id);
    if (!store) return res.status(404).json({ error: { message: 'Store not found' } });

    const before = { ...store };
    const { name, address, phone, email, gstin, invoicePrefix } = req.body;
    if (name) store.name = name;
    if (address) store.address = address;
    if (phone) store.phone = phone;
    if (email) store.email = email;
    if (gstin) store.gstin = gstin;
    if (invoicePrefix) store.invoice_prefix = invoicePrefix;
    store.updated_at = new Date().toISOString();

    // Persist to Supabase
    if (isSupabaseConfigured) {
      const { SupabaseDb } = await import('./server/supabaseDb.ts');
      await SupabaseDb.updateStore(store.id, store).catch(() => {});
    }

    AuditService.log({
      storeId: store.id,
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'SETTINGS_UPDATED',
      entityType: 'STORE',
      entityId: store.id,
      beforeData: before,
      afterData: { ...store },
    });

    res.json(store);
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Internal Server Error',
    },
  });
});

// ==========================================
// VITE DEV SERVER / STATIC ASSETS
// ==========================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Only launch standalone HTTP server when NOT running inside Vercel serverless environment
if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export default app;
export { app };


