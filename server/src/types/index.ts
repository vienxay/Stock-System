import { Request } from 'express';
import { RoleCode } from '@prisma/client';

// ─── Auth ────────────────────────────────────────────────────

export interface JwtPayload {
  id:   number;
  role: RoleCode;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user: {
    id:         number;
    roleId:     number;
    username:   string;
    fullName:   string;
    email:      string | null;
    department: string | null;
    isActive:   boolean;
    role: {
      code:   RoleCode;
      nameLo: string;
    };
  };
}

// ─── Pagination ──────────────────────────────────────────────

export interface PaginationQuery {
  page?:  string;
  limit?: string;
}

export interface PaginationMeta {
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── PR ──────────────────────────────────────────────────────

export interface CreatePrDto {
  department?:   string;
  purpose?:      string;
  priority?:     'low' | 'normal' | 'high' | 'urgent';
  required_date?: string;
  note?:         string;
  items: CreatePrItemDto[];
}

export interface CreatePrItemDto {
  product_id:  number;
  quantity:    number;
  unit_price?: number;
  supplier_id?: number;
  note?:       string;
}

export interface ApproveDto {
  decision: 'approved' | 'rejected';
  comment?: string;
}

// ─── GR ──────────────────────────────────────────────────────

export interface ReceiveGoodsDto {
  items:          ReceiveItemDto[];
  received_date?: string;
  note?:          string;
}

export interface ReceiveItemDto {
  po_item_id:   number;
  received_qty: number;
  rejected_qty?: number;
  note?:        string;
}

// ─── Invoice ─────────────────────────────────────────────────

export interface CreateInvoiceDto {
  po_id:          number;
  gr_id:          number;
  invoice_number: string;
  invoice_date:   string;
  due_date?:      string;
  invoice_amount: number;
  tax_amount?:    number;
  note?:          string;
}

export interface CreatePaymentDto {
  payment_date:   string;
  payment_method?: 'bank_transfer' | 'cash' | 'cheque';
  amount_paid:    number;
  bank_ref?:      string;
  note?:          string;
}

// ─── Filters ─────────────────────────────────────────────────

export interface PrFilter extends PaginationQuery {
  status?:       string;
  requester_id?: string;
  from_date?:    string;
  to_date?:      string;
}

export interface PoFilter extends PaginationQuery {
  status?:      string;
  supplier_id?: string;
}

export interface StockMovementFilter extends PaginationQuery {
  product_id?:    string;
  movement_type?: string;
  from_date?:     string;
  to_date?:       string;
}

export interface IssueOutDto {
  product_id: number;
  quantity:   number;
  note?:      string;
  ref_type?:  string;
  ref_id?:    number;
}

export interface AdjustStockDto {
  product_id:    number;
  quantity:      number;
  movement_type: 'adjust_in' | 'adjust_out';
  note?:         string;
}

export interface ProductFilter extends PaginationQuery {
  search?:      string;
  category_id?: string;
  low_stock?:   string;
}
