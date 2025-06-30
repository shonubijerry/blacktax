import { OpenAPIRoute } from 'chanfana'
import { getPrismaClient } from '../helper'
import { AppContext } from '../types'

type TransferStatus = {
  reference: string
  transfer_code: string
  status: string
  failure_reason: string
}

export class PaystackWebhookHandler extends OpenAPIRoute {
  schema = {
    tags: ['Webhooks'],
    summary: 'Handle Paystack transfer webhooks',
    responses: {
      '200': { description: 'Webhook processed successfully' },
      '400': { description: 'Invalid webhook' },
    },
  }

  async handle(c: AppContext) {
    try {
      const signature = c.req.header('x-paystack-signature')
      const body = await c.req.text()

      // Verify webhook signature
      const crypto = await import('crypto')
      const hash = crypto
        .createHmac('sha512', c.env.PAYSTACK_SECRET_KEY)
        .update(body)
        .digest('hex')

      if (hash !== signature) {
        return c.json({ error: 'Invalid signature' }, 400)
      }

      const event = JSON.parse(body) as {
        event: string
        data: TransferStatus
      }

      if (
        event.event === 'transfer.success' ||
        event.event === 'transfer.failed'
      ) {
        await this.handleTransferStatusChange(event.data, c)
      }

      return c.json({ success: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return c.json({ error: 'Webhook processing failed' }, 500)
    }
  }

  private async handleTransferStatusChange(
    transferData: TransferStatus,
    c: AppContext,
  ) {
    const prisma = getPrismaClient(c.env)

    try {
      // Find transfer by reference or transfer code
      const transferRecipient = await prisma.transferRecipient.findFirst({
        where: {
          OR: [
            { paystackReference: transferData.reference },
            { paystackTransferCode: transferData.transfer_code },
          ],
        },
      })

      if (transferRecipient) {
        const newStatus =
          transferData.status === 'success' ? 'SUCCESS' : 'FAILED'

        await prisma.transferRecipient.update({
          where: { id: transferRecipient.id },
          data: {
            status: newStatus,
            transferredAt: newStatus === 'SUCCESS' ? new Date() : undefined,
            failureReason:
              newStatus === 'FAILED' ? transferData.failure_reason : undefined,
            updatedAt: new Date(),
          },
        })

        console.log(
          `Updated transfer recipient ${transferRecipient.id} to ${newStatus}`,
        )
      }
    } catch (error) {
      console.error('Error updating transfer from webhook:', error)
    } finally {
      await prisma.$disconnect()
    }
  }
}
