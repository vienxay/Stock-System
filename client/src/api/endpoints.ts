import api from './client';
import type {
  LoginResponse, Product, Category, Supplier,
  PurchaseRequest, PurchaseOrder, Invoice, StockMovement,
  Notification, DashboardSummary,
} from '@/types';

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login:          (username: string, password: string) =>
    api.post<{ data: LoginResponse }>('/auth/login', { username, password }),
  me:             () => api.get('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    api.patch('/auth/change-password', { old_password, new_password }),
  logout:         () => api.post('/auth/logout'),
};

// ─── Dashboard ───────────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get<{ data: DashboardSummary }>('/dashboard/summary'),
};

// ─── Products ────────────────────────────────────────────────
export const productApi = {
  list:   (params?: object) => api.get<{ data: Product[] }>('/products', { params }),
  get:    (id: number)      => api.get<{ data: Product }>(`/products/${id}`),
  create: (body: object)    => api.post('/products', body),
  update: (id: number, body: object) => api.put(`/products/${id}`, body),
  import: (products: object[]) => api.post('/products/import', { products }),
};

// ─── Categories ──────────────────────────────────────────────
export const categoryApi = {
  list:   () => api.get<{ data: Category[] }>('/categories'),
  create: (body: object) => api.post('/categories', body),
  update: (id: number, body: object) => api.put(`/categories/${id}`, body),
  remove: (id: number) => api.delete(`/categories/${id}`),
};

// ─── Suppliers ───────────────────────────────────────────────
export const supplierApi = {
  list:   (params?: object) => api.get<{ data: Supplier[] }>('/suppliers', { params }),
  create: (body: object)    => api.post('/suppliers', body),
  update: (id: number, body: object) => api.put(`/suppliers/${id}`, body),
  remove: (id: number)               => api.delete(`/suppliers/${id}`),
};

// ─── Purchase Requests ───────────────────────────────────────
export const prApi = {
  list:    (params?: object) => api.get<{ data: PurchaseRequest[] }>('/purchase-requests', { params }),
  get:     (id: number)      => api.get(`/purchase-requests/${id}`),
  create:  (body: object)    => api.post('/purchase-requests', body),
  submit:  (id: number)      => api.patch(`/purchase-requests/${id}/submit`),
  cancel:  (id: number)      => api.patch(`/purchase-requests/${id}/cancel`),
  approve:  (id: number, body: object) => api.patch(`/purchase-requests/${id}/approve`, body),
  createPO: (id: number, supplier_id: number) => api.post(`/purchase-requests/${id}/create-po`, { supplier_id }),
};

// ─── Purchase Orders ─────────────────────────────────────────
export const poApi = {
  list:         (params?: object) => api.get<{ data: PurchaseOrder[] }>('/purchase-orders', { params }),
  get:          (id: number)      => api.get(`/purchase-orders/${id}`),
  markSent:     (id: number)      => api.patch(`/purchase-orders/${id}/send`),
  receiveGoods: (id: number, body: object) => api.post(`/purchase-orders/${id}/receive`, body),
  needsInvoice: ()                => api.get('/purchase-orders/needs-invoice'),
};

// ─── Invoices ────────────────────────────────────────────────
export const invoiceApi = {
  list:           (params?: object) => api.get<{ data: Invoice[] }>('/invoices', { params }),
  create:         (body: object)    => api.post('/invoices', body),
  approve:        (id: number)      => api.patch(`/invoices/${id}/approve`),
  pay:            (id: number, body: object) => api.post(`/invoices/${id}/pay`, body),
  updateAmount:   (id: number, body: object) => api.patch(`/invoices/${id}/amount`, body),
  overrideApprove:(id: number, comment: string) => api.patch(`/invoices/${id}/override-approve`, { comment }),
  cancel:         (id: number)      => api.delete(`/invoices/${id}`),
};

// ─── Users (admin) ───────────────────────────────────────────
export const userApi = {
  list:          (params?: object)       => api.get('/users', { params }),
  get:           (id: number)            => api.get(`/users/${id}`),
  create:        (body: object)          => api.post('/users', body),
  update:        (id: number, body: object) => api.put(`/users/${id}`, body),
  resetPassword: (id: number, newPassword: string) =>
    api.patch(`/users/${id}/reset-password`, { newPassword }),
};

// ─── Units ───────────────────────────────────────────────────
export const unitApi = {
  list: () => api.get('/units'),
};

// ─── Stock Movements ─────────────────────────────────────────
export const stockApi = {
  list:        (params?: object) => api.get<{ data: StockMovement[] }>('/stock-movements', { params }),
  byProduct:   (id: number, params?: object) => api.get(`/stock-movements/product/${id}`, { params }),
  issueOut:    (body: object) => api.post('/stock-movements/issue', body),
  adjust:      (body: object) => api.post('/stock-movements/adjust', body),
};

// ─── Settings ────────────────────────────────────────────────
export const settingsApi = {
  get:    () => api.get('/settings'),
  update: (body: object) => api.put('/settings', body),
};

// ─── Audit Logs ──────────────────────────────────────────────
export const auditApi = {
  list:  (params?: object) => api.get('/audit-logs',       { params }),
  stats: ()                => api.get('/audit-logs/stats'),
};

// ─── Upload ──────────────────────────────────────────────────
export const uploadApi = {
  productImage: async (file: File): Promise<string> => {
    const token = (await import('@/stores/authStore')).useAuthStore.getState().accessToken;
    const form  = new FormData();
    form.append('image', file);
    const res  = await fetch('/api/v1/upload/product-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json() as { data?: { url: string }; message?: string };
    if (!res.ok) throw new Error(json.message ?? 'Upload ລົ້ມເຫລວ');
    return json.data!.url;
  },
};

// ─── Reports (Excel download) ────────────────────────────────
type ReportFilters = { from?: string; to?: string; status?: string; type?: string };

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const reportApi = {
  download: async (type: 'stock' | 'purchase-requests' | 'purchase-orders' | 'invoices' | 'stock-movements', filters: ReportFilters = {}) => {
    const token = (await import('@/stores/authStore')).useAuthStore.getState().accessToken;
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v) as [string, string][]);
    const res = await fetch(`/api/v1/reports/${type}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('ດາວໂຫລດລົ້ມເຫລວ');
    const blob = await res.blob();
    downloadBlob(blob, `${type}-report.xlsx`);
  },
};

// ─── Notifications ───────────────────────────────────────────
export const notifApi = {
  list:    (params?: object) => api.get<{ data: Notification[] }>('/notifications', { params }),
  read:    (id: number)      => api.patch(`/notifications/${id}/read`),
  readAll: ()                => api.patch('/notifications/read-all'),
};
