const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountNumber: string;
  bankCode: string;
  bankName?: string | null;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFamilyMemberData {
  name?: string;
  email?: string;
  phone?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string | null;
  balance?: number;
}

export interface UpdateFamilyMemberData extends Partial<CreateFamilyMemberData> {
  paystackRecipientCode?: string;
}

export interface TransferRequest {
  recipients: Array<{
    id: string;
    amount: number;
  }>;
  reference?: string;
  callbackUrl?: string;
  description?: string;
}

export interface Transfer {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  description?: string;
  currency?: string;
  paystackBatchId: string;
  createdAt: string;
  updatedAt: string;
  recipients: Array<{
    id: string;
    amount: number;
    status: string;
    paystackReference: string;
    transferredAt: string;
    failureReason: string;
    recipient: {
      id: string
      name: string;
      email: string;
    }
  }>;
}

export interface Bank {
  name: string;
  code: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.text().catch((error) => error.message);
    throw new ApiError(response.status, errorData || `HTTP ${response.status}`);
  }

  return response.json();
}

export const blackTaxApi = {
  // Family Members
  getMembers: (params?: { page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('page', (params?.page ?? 1).toString())
    searchParams.append('limit', (params?.limit ?? 20).toString())
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    return apiRequest<{ data: FamilyMember[]; pagination: any }>(`/family-members${query ? `?${query}` : ''}`);
  },

  getMember: (id: string) =>
    apiRequest<FamilyMember>(`/family-members/${id}`),

  createMember: (data: CreateFamilyMemberData) =>
    apiRequest<FamilyMember>('/family-members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMember: (id: string, data: UpdateFamilyMemberData) =>
    apiRequest<FamilyMember>(`/family-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMember: (id: string) =>
    apiRequest<{ success: boolean }>(`/family-members/${id}`, {
      method: 'DELETE',
    }),

  // Transfers
  createTransfer: (data: TransferRequest) =>
    apiRequest<{ status: string; reference: string; transfer_code: string }>('/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTransfers: () =>
    apiRequest<{ data: Transfer[] }>('/transfers'),

  getBanks: () =>
    apiRequest<{ data: Bank[] }>('/banks'),
};
