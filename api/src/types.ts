import type { Context } from 'hono'
import { z } from 'zod'

export type AppContext = Context<{ Bindings: Env }>

export const FamilyMemberCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  accountNumber: z.string().min(10, 'Valid account number is required'),
  bankCode: z.string().min(3, 'Valid bank code is required'),
  bankName: z.string().optional(),
  balance: z.number().min(0).default(0),
})

export const FamilyMemberUpdateSchema = FamilyMemberCreateSchema.extend({
  paystackRecipientCode: z.string(),
}).partial()

export const TransferRequestSchema = z.object({
  recipients: z
    .object({
      id: z.string().min(1, 'At least one recipient is required'),
      amount: z.number().positive().min(1, 'At least one amount is required'),
    })
    .array(),
  reference: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  description: z.string().optional(),
})

export const FamilyMemberResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  accountNumber: z.string(),
  bankCode: z.string(),
  bankName: z.string().nullable(),
  balance: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const paginationSchema = z.object({
  page: z.number().int().default(1).describe('Page number (default: 1)'),
  limit: z.number().int().default(20).describe('Items per page (default: 20)'),
  search: z.string().optional().describe('Search by name or email'),
})

export const paystackTransferRes = z
  .object({
    status: z.boolean(),
    data: z.object({
      status: z.string(),
      reference: z.string(),
      transfer_code: z.string(),
    }),
  })
  .transform((value) => value.data)

export const verifyTransactionRes = z
  .object({
    status: z.boolean(),
    data: z.object({
      status: z.string(),
    }),
  })
  .transform((value) => value.data.status === 'success')

export const BankSchema = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  code: z.string(),
})
