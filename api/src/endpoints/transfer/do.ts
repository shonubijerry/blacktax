import { OpenAPIRoute } from 'chanfana'
import { $Enums, FamilyMember, TransferRecipient } from '../../generated/prisma'
import { generateReference, getPrismaClient, reqJson } from '../../helper'
import {
  createPaystackRecipient,
  initiateBulkPaystackTransfer,
  verifyPayment,
} from '../../paystack/paystack'
import { AppContext, TransferRequestSchema } from '../../types'

export class TransferMoney extends OpenAPIRoute {
  schema = {
    tags: ['Transfers'],
    summary: 'Transfer money to family members via Paystack bulk transfer',
    request: {
      body: reqJson(TransferRequestSchema),
    },
    responses: {
      '200': { description: 'Bulk transfer initiated successfully' },
      '400': { description: 'Invalid request data' },
    },
  }

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>()
    const prisma = getPrismaClient(c.env)

    try {
      const transferData = data.body

      if (!(await verifyPayment(c.env, transferData.reference))) {
        return c.json(
          { success: false, error: 'No payment made for this transaction' },
          400,
        )
      }

      if (!transferData.recipients.length) {
        return c.json({ success: false, error: 'No recipient provided' }, 400)
      }

      const reference = transferData.reference || generateReference()
      const recipientIds = transferData.recipients.map((r) => r.id)
      const recipientAmountMap = new Map(
        transferData.recipients.map((r) => [r.id, r.amount]),
      )
      const totalAmount = [...recipientAmountMap.values()].reduce(
        (a, b) => a + b,
        0,
      )

      // Step 1: Create the main transfer transaction
      const transfer = await prisma.transferTransaction.create({
        data: {
          reference,
          totalAmount,
          callbackUrl: transferData.callbackUrl,
          description: transferData.description,
          status: 'PENDING',
        },
      })

      // Step 2: Fetch recipients
      const recipients = await prisma.familyMember.findMany({
        where: { id: { in: recipientIds }, isActive: true },
      })

      if (recipients.length !== recipientIds.length) {
        throw new Error('Some recipients not found or inactive')
      }

      // Step 3: Prepare recipients and ensure they have Paystack recipient codes
      const bulkTransferData = []
      const transferRecipients: (TransferRecipient & {
        recipient: FamilyMember
        error?: string
      })[] = []

      for (const [index, recipient] of recipients.entries()) {
        const amount = recipientAmountMap.get(recipient.id)
        const uniqueReference = `${reference}_${index + 1}`

        try {
          let recipientCode = recipient.paystackRecipientCode

          // Create Paystack recipient if missing
          if (!recipientCode) {
            recipientCode = await createPaystackRecipient(recipient, c.env)

            // Update recipient with Paystack recipient code
            await prisma.familyMember.update({
              where: { id: recipient.id },
              data: { paystackRecipientCode: recipientCode },
            })
          }

          // Prepare data for bulk transfer
          bulkTransferData.push({
            amount: amount * 100, // Convert to kobo
            recipient: recipientCode,
            reference: uniqueReference,
            reason: transferData.description || 'Family transfer',
          })

          // Create transferRecipient in DB with PENDING status
          const transferRecipient = await prisma.transferRecipient.create({
            data: {
              transferId: transfer.id,
              recipientId: recipient.id,
              amount,
              status: 'PENDING',
              paystackReference: uniqueReference,
            },
          })

          transferRecipients.push({
            ...transferRecipient,
            recipient,
          })
        } catch (error) {
          console.error(`Failed to prepare recipient ${recipient.id}:`, error)

          const failedRecipient = await prisma.transferRecipient.create({
            data: {
              transferId: transfer.id,
              recipientId: recipient.id,
              amount,
              status: 'FAILED',
              failureReason: (error as Error).message,
            },
          })

          transferRecipients.push({
            ...failedRecipient,
            recipient,
            error: (error as Error).message,
          })
        }
      }

      // Step 4: Initiate bulk transfer if we have valid recipients
      const validTransfers = bulkTransferData.filter(Boolean)
      let bulkTransferResult: Awaited<ReturnType<typeof initiateBulkPaystackTransfer>> = null

      if (validTransfers.length > 0) {
        try {
          bulkTransferResult = await initiateBulkPaystackTransfer(
            c.env,
            validTransfers
          )

          // Update transfer recipients with bulk transfer results
          if (bulkTransferResult && bulkTransferResult.length > 0) {
            for (const [index, result] of bulkTransferResult.entries()) {
              const transferRecipient = transferRecipients.find(
                (tr) => tr.paystackReference === result.reference,
              )

              if (transferRecipient) {
                await prisma.transferRecipient.update({
                  where: { id: transferRecipient.id },
                  data: {
                    status: result.status === 'success' ? 'SUCCESS' : 'PENDING',
                    paystackTransferCode: result.transfer_code,
                  },
                })

                // Update local object for response
                transferRecipient.status = result.status === 'success' ? 'SUCCESS' : 'PENDING'
                transferRecipient.paystackTransferCode = result.transfer_code
              }
            }
          }
        } catch (error) {
          console.error('Bulk transfer failed:', error)

          // Mark all pending transfers as failed
          const pendingRecipients = transferRecipients.filter(
            (r) => r.status === 'PENDING',
          )

          for (const recipient of pendingRecipients) {
            await prisma.transferRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                failureReason: (error as Error).message,
              },
            })

            recipient.status = 'FAILED'
            recipient.error = (error as Error).message
          }
        }
      }

      // Step 5: Calculate overall status
      const statusCounts = transferRecipients.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        },
        {} as Record<$Enums.TransferStatus, number>,
      )

      let overallStatus: $Enums.TransferStatus = 'PENDING'
      if (statusCounts.SUCCESS === transferRecipients.length) {
        overallStatus = 'SUCCESS'
      } else if (statusCounts.FAILED === transferRecipients.length) {
        overallStatus = 'FAILED'
      } else {
        overallStatus = 'PROCESSING'
      }

      const updatedTransfer = await prisma.transferTransaction.update({
        where: { id: transfer.id },
        data: { status: overallStatus },
      })

      return c.json(
        {
          success: true,
          data: {
            ...updatedTransfer,
            createdAt: updatedTransfer.createdAt.toISOString(),
            updatedAt: updatedTransfer.updatedAt.toISOString(),
            bulkTransferCode: reference || null,
            recipients: transferRecipients.map((r) => ({
              ...r,
              createdAt: r.createdAt?.toISOString?.() || '',
              updatedAt: r.updatedAt?.toISOString?.() || '',
              transferredAt: r.transferredAt?.toISOString?.() || null,
            })),
          },
        },
        200,
      )
    } catch (error) {
      console.error('Error processing bulk transfer:', error)
      return c.json({ success: false, error: (error as Error).message }, 500)
    } finally {
      await prisma.$disconnect()
    }
  }
}
