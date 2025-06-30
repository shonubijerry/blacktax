import { OpenAPIRoute } from 'chanfana'
import { getPrismaClient, mapPaystackStatusToLocal } from '../../helper'
import { PaystackClient } from '../../paystack/paystack'
import { AppContext } from '../../types'

// Bulk transfer status checker (alternative approach for bulk transfers)
export class UpdateBulkTransferStatusCron extends OpenAPIRoute {
  schema = {
    tags: ['Cron Jobs'],
    summary: 'Update bulk transfer statuses from Paystack',
    responses: {
      '200': { description: 'Bulk status update completed' },
      '500': { description: 'Error updating bulk statuses' },
    },
  }

  async handle(c: AppContext) {
    const prisma = getPrismaClient(c.env)
    let updatedCount = 0
    let errorCount = 0

    try {
      console.log('Starting bulk transfer status update cron job...')

      // Get transfers that might be part of bulk operations
      const bulkTransfers = await prisma.transferTransaction.findMany({
        where: {
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        include: {
          recipients: true,
        },
      })

      // Group by potential batch codes (you might need to store batch codes in your DB)
      const batchGroups = new Map<string, typeof bulkTransfers>()

      for (const transfer of bulkTransfers) {
        // If you store batch codes, group by them
        // For now, we'll process individually
        const batchKey = transfer.reference.split('_')[0] // Assuming reference format
        if (!batchGroups.has(batchKey)) {
          batchGroups.set(batchKey, [])
        }
        batchGroups.get(batchKey).push(transfer)
      }

      for (const [batchKey, transfers] of batchGroups) {
        try {
          // For each batch, you could fetch bulk status if you have batch codes
          // Otherwise, fall back to individual status checks
          for (const transfer of transfers) {
            for (const recipient of transfer.recipients) {
              if (
                recipient.status === 'PENDING' ||
                recipient.status === 'PROCESSING'
              ) {
                try {
                  const paystackStatus = await new PaystackClient(
                    c.env,
                  ).fetchTransferStatus(
                    recipient.paystackTransferCode,
                    recipient.paystackReference,
                  )

                  if (paystackStatus) {
                    const newStatus = mapPaystackStatusToLocal(
                      paystackStatus.status,
                    )

                    if (newStatus !== recipient.status) {
                      await prisma.transferRecipient.update({
                        where: { id: recipient.id },
                        data: {
                          status: newStatus,
                          transferredAt:
                            newStatus === 'SUCCESS' ? new Date() : undefined,
                          failureReason:
                            newStatus === 'FAILED'
                              ? paystackStatus.failure_reason
                              : undefined,
                          updatedAt: new Date(),
                        },
                      })
                      updatedCount++
                    }
                  }
                } catch (error) {
                  console.error(
                    `Error updating recipient ${recipient.id}:`,
                    error,
                  )
                  errorCount++
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing batch ${batchKey}:`, error)
          errorCount++
        }
      }

      return c.json({
        success: true,
        message: 'Bulk transfer status update completed',
        stats: {
          batchesProcessed: batchGroups.size,
          recipientsUpdated: updatedCount,
          errors: errorCount,
        },
      })
    } catch (error) {
      console.error('Error in bulk transfer status cron job:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to update bulk transfer statuses',
          message: (error as Error).message,
        },
        500,
      )
    } finally {
      await prisma.$disconnect()
    }
  }
}
