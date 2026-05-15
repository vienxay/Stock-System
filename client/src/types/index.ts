export type RoleCode = 'user' | 'finance' | 'md' | 'stock' | 'purchasing' | 'ap' | 'admin';
export type PrStatus = 'draft' | 'finance_review' | 'finance_rejected' | 'md_review' | 'md_approved' | 'md_rejected' | 'po_created' | 'cancelled';
export type PoStatus = 'open' | 'sent' | 'partial_received' | 'received' | 'cancelled';
export type InvoiceStatus = 'received' | 'matched' | 'mismatch' | 'approved' | 'paid';
export type MovementType = 'gr_in' | 'issue_out' | 'return_in' | 'adjust_in' | 'adjust_out' | 'transfer';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface PaginationMeta {
  total: number; page: number; limit: number;
  totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;
}
export interface ApiSuccess<T> { success: true; message: string; data: T; }
export interface ApiPaginated<T> { success: true; message: string; data: T[]; pagination: PaginationMeta; }

export interface AuthUser {
  id: number; username: string; fullName: string;
  email: string | null; department: string | null;
  role: { code: RoleCode; nameLo: string };
}
export interface LoginResponse { accessToken: string; refreshToken: string; user: AuthUser; }

export interface AppUser {
  id: number; username: string; fullName: string; email?: string;
  phone?: string; department?: string; employeeId?: string;
  isActive: boolean; createdAt: string;
  role: { code: RoleCode; nameLo: string; nameEn?: string };
}

export interface Product {
  id: number; code: string; nameLo: string; nameEn?: string;
  currentStock: number; minStock: number; maxStock: number;
  standardPrice: number; isActive: boolean;
  barcode?: string; location?: string; description?: string;
  imageUrl?: string;
  category: { id: number; nameLo: string };
  unit: { id: number; nameLo: string };
}
export interface Category { id: number; code: string; nameLo: string; nameEn?: string; parentId?: number; isActive: boolean; }
export interface Unit     { id: number; code: string; nameLo: string; nameEn?: string; }
export interface Supplier {
  id: number; code: string; name: string; taxId?: string;
  contactName?: string; phone?: string; email?: string;
  address?: string; bankName?: string; bankAccount?: string;
  paymentTerm: number; isActive: boolean;
}

export interface PurchaseRequest {
  id: number; prNumber: string; status: PrStatus; priority: Priority;
  totalAmount: number; purpose?: string; department?: string;
  requiredDate?: string; note?: string; createdAt: string;
  requester: { fullName: string; department?: string };
  _count?: { items: number };
}
export interface PurchaseOrder {
  id: number; poNumber: string; status: PoStatus;
  totalAmount: number; createdAt: string; sentAt?: string;
  supplier: { name: string; phone?: string };
  creator: { fullName: string };
}
export interface Invoice {
  id: number; invoiceNumber: string; status: InvoiceStatus;
  invoiceAmount: number; totalAmount: number; taxAmount: number;
  matchVariance: number; invoiceDate: string; dueDate?: string; createdAt: string;
  supplier: { name: string };
  purchaseOrder: { poNumber: string };
  goodsReceipt: { grNumber: string };
}
export interface StockMovement {
  id: number; movementType: MovementType; quantity: number;
  beforeQty: number; afterQty: number; note?: string;
  refType?: string; refId?: number; createdAt: string;
  product: { nameLo: string; code: string; unit: { nameLo: string } };
  creator?: { fullName: string };
}
export interface Notification {
  id: number; type: string; title: string; message?: string;
  isRead: boolean; refType?: string; refId?: number; createdAt: string;
}
export interface DashboardSummary {
  pr:  { status: PrStatus; _count: { id: number } }[];
  po:  { status: PoStatus; _count: { id: number } }[];
  lowStockCount:     number;
  pendingInvoices:   number;
  totalPaidAmount:   number;
  thisMonthPaid:     number;
  thisYearPaid:      number;
  pendingPaymentAmt: number;
  monthly:           { month: string; prCount: number; poAmount: number }[];
  lowStockItems:     { id: number; code: string; nameLo: string; currentStock: number; minStock: number }[];
  flow:              { pr: number; po: number; gr: number; invoice: number; paid: number };
}
