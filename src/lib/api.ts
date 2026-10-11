import {
  Product,
  Category,
  Sale,
  StockMovement,
  Expense,
  User,
  Store,
  DashboardSummary,
  VerificationResponse,
  AuditLog,
} from '../types';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('ledger_session_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('ledger_session_token', token);
      } else {
        localStorage.removeItem('ledger_session_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('ledger_session_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const currentToken = this.getToken();
    if (currentToken) {
      headers.set('x-session-token', currentToken);
    }

    const res = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.error?.message || data?.message || `Request failed (${res.status})`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: User; store: Store }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async logout() {
    try {
      await this.request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
    return { success: true };
  }

  async getSession() {
    return this.request<{ user: User; store: Store }>('/api/auth/session');
  }

  // Verification (public)
  async verifyBill(token: string) {
    return this.request<VerificationResponse>(`/api/verify/${token}`);
  }

  // QR Generator
  async getQRCode(text: string) {
    return this.request<{ dataUrl: string }>(`/api/qr?text=${encodeURIComponent(text)}`);
  }

  // Products
  async getProducts(params?: { search?: string; barcode?: string; categoryId?: string; lowStock?: boolean; outOfStock?: boolean; activeOnly?: boolean }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.barcode) query.set('barcode', params.barcode);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.lowStock) query.set('lowStock', 'true');
    if (params?.outOfStock) query.set('outOfStock', 'true');
    if (params?.activeOnly !== undefined) query.set('activeOnly', String(params.activeOnly));
    return this.request<Product[]>(`/api/products?${query.toString()}`);
  }

  async createProduct(payload: any) {
    return this.request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateProduct(id: string, payload: any) {
    return this.request<Product>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async toggleProductActive(id: string, activate: boolean) {
    return this.request<Product>(`/api/products/${id}/${activate ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    });
  }

  // Categories
  async getCategories() {
    return this.request<Category[]>('/api/categories');
  }

  async createCategory(payload: { name: string; description?: string }) {
    return this.request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Inventory
  async receiveStock(payload: {
    productId: string;
    quantity: number;
    reason?: string;
    purchasePrice?: number;
    taxRate?: number;
    taxType?: 'EXCLUSIVE' | 'INCLUSIVE';
    supplierInvoice?: string;
    supplierGstin?: string;
  }) {
    return this.request<{ product: Product; movement: StockMovement }>('/api/inventory/receive', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async adjustStock(payload: { productId: string; quantityDifference: number; reason: string; type?: string }) {
    return this.request<{ product: Product; movement: StockMovement }>('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStockMovements(params?: { productId?: string; type?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.productId) query.set('productId', params.productId);
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<StockMovement[]>(`/api/inventory/movements?${query.toString()}`);
  }

  // Sales / Billing
  async createSale(payload: {
    items: Array<{ productId: string; quantity: number }>;
    discount?: number;
    paymentMethod: string;
    notes?: string;
    gstType?: 'INTRA_STATE' | 'INTER_STATE' | 'EXEMPT';
    customerName?: string;
    customerPhone?: string;
    customerGstin?: string;
  }) {
    return this.request<Sale>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSales(params?: {
    search?: string;
    from?: string;
    to?: string;
    employeeId?: string;
    paymentMethod?: string;
    status?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.employeeId) query.set('employeeId', params.employeeId);
    if (params?.paymentMethod) query.set('paymentMethod', params.paymentMethod);
    if (params?.status) query.set('status', params.status);
    return this.request<Sale[]>(`/api/sales?${query.toString()}`);
  }

  async getSaleById(id: string) {
    return this.request<Sale>(`/api/sales/${id}`);
  }

  async voidSale(id: string, reason: string) {
    return this.request<Sale>(`/api/sales/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Employees
  async getEmployees() {
    return this.request<User[]>('/api/employees');
  }

  async createEmployee(payload: { name: string; email: string; password: string; role?: string }) {
    return this.request<User>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async toggleEmployeeActive(id: string, activate: boolean) {
    return this.request<User>(`/api/employees/${id}/${activate ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    });
  }

  // Expenses
  async getExpenses(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return this.request<Expense[]>(`/api/expenses?${query.toString()}`);
  }

  async createExpense(payload: { category: string; amount: number; description?: string; expenseDate?: string }) {
    return this.request<Expense>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async voidExpense(id: string) {
    return this.request<Expense>(`/api/expenses/${id}/void`, { method: 'POST' });
  }

  // Dashboard & Reports
  async getDashboardSummary() {
    return this.request<DashboardSummary>('/api/dashboard/summary');
  }

  async getSalesReport(params?: { from?: string; to?: string; employeeId?: string; paymentMethod?: string; status?: string }) {
    const query = new URLSearchParams(params as any);
    return this.request<{ rows: any[]; summary: any }>(`/api/reports/sales?${query.toString()}`);
  }

  async getInventoryReport() {
    return this.request<{ rows: any[]; summary: any }>('/api/reports/inventory');
  }

  async getProfitReport(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams(params as any);
    return this.request<{ summary: any }>(`/api/reports/profit?${query.toString()}`);
  }

  async getEmployeeReport(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams(params as any);
    return this.request<any[]>(`/api/reports/employees?${query.toString()}`);
  }

  // Audit Logs
  async getAuditLogs(params?: { action?: string; entityType?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<AuditLog[]>(`/api/audit-logs?${query.toString()}`);
  }

  // Settings
  async getSettings() {
    return this.request<Store>('/api/settings');
  }

  async updateSettings(payload: Partial<Store>) {
    return this.request<Store>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
