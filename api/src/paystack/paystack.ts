import {
  paystackBulkTransferRes,
  paystackTransferRes,
  verifyTransactionRes,
} from '../types'

export class PaystackClient {
  private readonly baseUrl = 'https://api.paystack.co'
  private readonly secretKey: string
  private readonly isProduction: boolean

  constructor(private env: Env) {
    this.secretKey = env.PAYSTACK_SECRET_KEY
    this.isProduction = env.WRANGLER_ENVIRONMENT === 'production'
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { method: 'GET' | 'POST' },
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })

    if (!response.ok) {
      const error: Error = await response.json()
      throw new Error(error?.message || 'Paystack API request failed')
    }

    return response.json()
  }

  async createRecipient(member: {
    name: string
    accountNumber: string
    bankCode: string
  }): Promise<string> {
    const result = await this.request<{ data: { recipient_code: string } }>(
      '/transferrecipient',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'nuban',
          name: member.name,
          account_number: member.accountNumber,
          bank_code: member.bankCode,
          currency: 'NGN',
        }),
      },
    )

    return result.data.recipient_code
  }

  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reference: string,
  ) {
    const result = await this.request<unknown>('/transfer', {
      method: 'POST',
      body: JSON.stringify({
        source: 'balance',
        recipient: recipientCode,
        amount: Math.round(amount * 100),
        reference,
        reason: 'Family transfer',
      }),
    })

    return paystackTransferRes.parse(result)
  }

  async initiateBulkTransfer(
    transfers: {
      amount: number
      reference: string
      reason: string
      recipient: string
    }[],
  ) {
    const result = await this.request<unknown>('/transfer/bulk', {
      method: 'POST',
      body: JSON.stringify({
        source: 'balance',
        currency: 'NGN',
        transfers,
      }),
    })

    return paystackBulkTransferRes.parse(result)
  }

  async verifyTransaction(reference?: string) {
    const ref =
      reference ?? (this.isProduction ? '1751211408284' : 'T998698517224693')

    const result = await this.request<unknown>(`/transaction/verify/${ref}`, {
      method: 'GET',
    })

    return verifyTransactionRes.parse(result)
  }

  async fetchTransferStatus(transferCode?: string, reference?: string) {
    const url = transferCode
      ? `/transfer/${transferCode}`
      : `/transfer/verify/${reference}`

    try {
      const result = await this.request<{
        data: { status: string; failure_reason: string }
      }>(url, {
        method: 'GET',
      })

      return result.data
    } catch (error) {
      console.error('Error fetching Paystack transfer status:', error)
      return null
    }
  }

  async fetchBulkTransferStatus(batchCode: string) {
    try {
      const result = await this.request<{ data: unknown }>(
        `/transfer/bulk/${batchCode}`,
        {
          method: 'GET',
        },
      )

      return result.data
    } catch (error) {
      console.error('Error fetching Paystack bulk transfer status:', error)
      throw error
    }
  }
}
