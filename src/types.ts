export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  balance: number;
  apiKey?: string;
  isAdmin?: boolean;
  phone?: string;
}

export interface Coupon {
  code: string;
  discount_percent: number;
  expires_at: string;
  max_uses: number;
  used_count: number;
}

export interface GlobalSettings {
  landing_video_url: string;
  profit_markup_percent: number;
}

export interface SMMService {
  id: string;
  category: string;
  categorySortOrder?: number;
  name: string;
  ratePer1000: number; // in USD
  min: number;
  max: number;
  description?: string;
}

export type OrderStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

export interface SMMOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  category: string;
  targetUrl: string;
  quantity: number;
  charge: number;
  status: OrderStatus;
  createdAt: string;
  providerOrderId?: string;
}

export interface TicketReply {
  id: string;
  sender: 'user' | 'support';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'Open' | 'Closed' | 'Answered';
  replies: TicketReply[];
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  method: string;
  status: 'Pending' | 'Success' | 'Failed';
  createdAt: string;
}
