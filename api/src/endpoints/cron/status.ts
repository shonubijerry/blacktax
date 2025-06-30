import { OpenAPIRoute } from "chanfana"
import { AppContext } from "../../types"
import { getPrismaClient, mapPaystackStatusToLocal } from "../../helper"
import { $Enums } from "../../generated/prisma"
import { fetchPaystackTransferStatus } from "../../paystack/paystack"

export class UpdateTransferStatusCron extends OpenAPIRoute {
  schema = {
    tags: ['Cron Jobs'],
    summary: 'Update transfer statuses from Paystack',
    responses: {
      '200': { description: 'Status update completed' },
      '500': { description: 'Error updating statuses' },
    },
  }

  async handle(c: AppContext) {
    const prisma = getPrismaClient(c.env)
    let updatedCount = 0
    let errorCount = 0

    try {
      console.log('Starting transfer status update cron job...')

      // Step 1: Get all pending/processing transfers
      const pendingTransfers = await prisma.transferTransaction.findMany({
        where: {
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
          createdAt: {
            // Only check transfers from the last 30 days
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          recipients: {
            where: {
              status: {
                in: ['PENDING', 'PROCESSING'],
              },
            },
          },
        },
      })

      console.log(`Found ${pendingTransfers.length} pending transfers to check`)

      // Step 2: Update each transfer's recipients
      for (const transfer of pendingTransfers) {
        try {
          let hasUpdates = false
          const recipientUpdates: Array<{
            id: string
            status: $Enums.TransferStatus
            transferredAt?: Date
            failureReason?: string
          }> = []

          // Process each recipient
          for (const recipient of transfer.recipients) {
            try {
              let paystackStatus = null

              // Fetch status from Paystack
              if (recipient.paystackTransferCode) {
                paystackStatus = await fetchPaystackTransferStatus(
                  c.env,
                  recipient.paystackTransferCode,
                )
              } else if (recipient.paystackReference) {
                // Fallback: try to get status by reference
                paystackStatus = await fetchPaystackTransferStatus(
                  c.env,
                  null,
                  recipient.paystackReference,
                )
              }

              if (paystackStatus) {
                const newStatus = mapPaystackStatusToLocal(paystackStatus.status)

                if (newStatus !== recipient.status) {
                  recipientUpdates.push({
                    id: recipient.id,
                    status: newStatus,
                    transferredAt: newStatus === 'SUCCESS' ? new Date() : undefined,
                    failureReason: newStatus === 'FAILED' ? paystackStatus.failure_reason : undefined,
                  })
                  hasUpdates = true
                }
              }
            } catch (error) {
              console.error(`Error fetching status for recipient ${recipient.id}:`, error)
              errorCount++
            }
          }

          // Step 3: Update recipients in database
          if (hasUpdates) {
            for (const update of recipientUpdates) {
              await prisma.transferRecipient.update({
                where: { id: update.id },
                data: {
                  status: update.status,
                  transferredAt: update.transferredAt,
                  failureReason: update.failureReason,
                  updatedAt: new Date(),
                },
              })
              updatedCount++
            }

            // Step 4: Update overall transfer status
            const allRecipients = await prisma.transferRecipient.findMany({
              where: { transferId: transfer.id },
            })

            const statusCounts = allRecipients.reduce(
              (acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1
                return acc
              },
              {} as Record<$Enums.TransferStatus, number>,
            )

            let overallStatus: $Enums.TransferStatus = 'PENDING'
            if (statusCounts.SUCCESS === allRecipients.length) {
              overallStatus = 'SUCCESS'
            } else if (statusCounts.FAILED === allRecipients.length) {
              overallStatus = 'FAILED'
            } else if (statusCounts.SUCCESS > 0 || statusCounts.FAILED > 0) {
              overallStatus = 'PROCESSING'
            }

            // Update main transfer status if changed
            if (overallStatus !== transfer.status) {
              await prisma.transferTransaction.update({
                where: { id: transfer.id },
                data: {
                  status: overallStatus,
                  updatedAt: new Date(),
                },
              })
            }
          }
        } catch (error) {
          console.error(`Error processing transfer ${transfer.id}:`, error)
          errorCount++
        }
      }

      console.log(`Cron job completed. Updated: ${updatedCount}, Errors: ${errorCount}`)

      return c.json({
        success: true,
        message: 'Transfer status update completed',
        stats: {
          transfersChecked: pendingTransfers.length,
          recipientsUpdated: updatedCount,
          errors: errorCount,
        },
      })
    } catch (error) {
      console.error('Error in transfer status cron job:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to update transfer statuses',
          message: (error as Error).message,
        },
        500,
      )
    } finally {
      await prisma.$disconnect()
    }
  }
}
