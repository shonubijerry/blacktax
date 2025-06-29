import { OpenAPIRoute } from "chanfana";
import { generateReference, getPrismaClient, reqJson } from "../../helper";
import { AppContext, TransferRequestSchema } from "../../types";
import { createPaystackRecipient, initiatePaystackTransfer } from "../../paystack/paystack";
import { $Enums } from "@prisma/client";

export class TransferMoney extends OpenAPIRoute {
  schema = {
    tags: ['Transfers'],
    summary: 'Transfer money to family members via Paystack',
    request: {
      body: reqJson(TransferRequestSchema),
    },
    responses: {
      '200': { description: 'Transfer initiated successfully' },
      '400': { description: 'Invalid request data' },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const prisma = getPrismaClient(c.env);

    try {
      const transferData = data.body;

      if (!transferData.recipients.length) {
        return c.json({ success: false, status: 400, error: 'No recipient provided' });
      }

      const reference = transferData.reference || generateReference();
      const recipientIds = transferData.recipients.map(r => r.id);
      const recipientAmountMap = new Map(transferData.recipients.map(r => [r.id, r.amount]));
      const totalAmount = [...recipientAmountMap.values()].reduce((a, b) => a + b, 0);

      // Step 1: Create the main transfer transaction
      const transfer = await prisma.transferTransaction.create({
        data: {
          reference,
          totalAmount,
          callbackUrl: transferData.callbackUrl,
          description: transferData.description,
          status: 'PENDING',
        },
      });

      // Step 2: Fetch recipients
      const recipients = await prisma.familyMember.findMany({
        where: { id: { in: recipientIds }, isActive: true },
      });

      if (recipients.length !== recipientIds.length) {
        throw new Error('Some recipients not found or inactive');
      }

      const transferRecipients = [];

      // Step 3: Process each recipient (outside transaction)
      for (const [index, recipient] of recipients.entries()) {
        const amount = recipientAmountMap.get(recipient.id)!;
        const uniqueReference = `${reference}_${index + 1}`;

        try {
          let recipientCode = recipient.paystackRecipientCode;

          // Create Paystack recipient if missing
          if (!recipientCode) {
            recipientCode = await createPaystackRecipient(recipient, c.env);

            // Update blacktax recipient with Paystack recipient code
            await prisma.familyMember.update({
              where: { id: recipient.id },
              data: { paystackRecipientCode: recipientCode },
            });
          }

          // Call Paystack to initiate transfer
          const transferResult = await initiatePaystackTransfer(
            recipientCode,
            amount,
            uniqueReference,
            c.env
          );

          // Create transferRecipient in DB
          const transferRecipient = await prisma.transferRecipient.create({
            data: {
              transferId: transfer.id,
              recipientId: recipient.id,
              amount,
              status: transferResult.status === 'success' ? 'SUCCESS' : 'PENDING',
              paystackTransferCode: transferResult.transfer_code,
              paystackReference: transferResult.reference,
            },
          });

          transferRecipients.push({
            ...transferRecipient,
            recipient,
            paystack: transferResult,
          });

        } catch (error) {
          console.error(`Transfer failed for recipient ${recipient.id}:`, error);

          const failedRecipient = await prisma.transferRecipient.create({
            data: {
              transferId: transfer.id,
              recipientId: recipient.id,
              amount,
              status: 'FAILED',
              failureReason: (error as Error).message,
            },
          });

          transferRecipients.push({
            ...failedRecipient,
            recipient,
            error: (error as Error).message,
          });
        }
      }

      // Step 4: Calculate overall status
      const statusCounts = transferRecipients.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {} as Record<$Enums.TransferStatus, number>
      );

      let overallStatus: $Enums.TransferStatus = 'PENDING';
      if (statusCounts.SUCCESS === transferRecipients.length) {
        overallStatus = 'SUCCESS';
      } else if (statusCounts.FAILED === transferRecipients.length) {
        overallStatus = 'FAILED';
      } else {
        overallStatus = 'PROCESSING';
      }

      const updatedTransfer = await prisma.transferTransaction.update({
        where: { id: transfer.id },
        data: { status: overallStatus },
      });

      return c.json({
        success: true,
        data: {
          ...updatedTransfer,
          createdAt: updatedTransfer.createdAt.toISOString(),
          updatedAt: updatedTransfer.updatedAt.toISOString(),
          recipients: transferRecipients.map((r) => ({
            ...r,
            createdAt: r.createdAt?.toISOString?.() || '',
            updatedAt: r.updatedAt?.toISOString?.() || '',
            transferredAt: r.transferredAt?.toISOString?.() || null,
          })),
        },
      });
    } catch (error) {
      console.error('Error processing transfer:', error);
      return c.json({ success: false, error: (error as Error).message }, 500);
    } finally {
      await prisma.$disconnect();
    }
  }
}
