import { PrismaD1 } from '@prisma/adapter-d1'
import { ZodType } from 'zod'
import { $Enums, PrismaClient } from './generated/prisma'

export function generateReference(): string {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getPrismaClient(env: Env) {
  const adapter = new PrismaD1(env.DB)
  return new PrismaClient({ adapter })
}

export const reqJson = <T extends ZodType>(schema: T) => ({
  content: {
    'application/json': {
      schema,
    },
  },
})

// Helper function to map Paystack status to local enum
export const mapPaystackStatusToLocal = (paystackStatus: string): $Enums.TransferStatus => {
  switch (paystackStatus.toLowerCase()) {
    case 'success':
    case 'successful':
      return 'SUCCESS'
    case 'failed':
    case 'failure':
      return 'FAILED'
    case 'pending':
    case 'processing':
    case 'queued':
      return 'PROCESSING'
    case 'reversed':
    case 'cancelled':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}
