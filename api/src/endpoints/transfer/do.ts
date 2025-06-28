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
      const recipientAmountMap = new Map(
        transferData.recipients.map(r => [r.id, r.amount])
      );
      const totalAmount = [...recipientAmountMap.values()].reduce((a, b) => a + b, 0);

      const result = await prisma.$transaction(async (tx) => {
        const transfer = await tx.transferTransaction.create({
          data: {
            reference,
            totalAmount,
            callbackUrl: transferData.callbackUrl,
            description: transferData.description,
          },
        });

        const recipients = await tx.familyMember.findMany({
          where: {
            id: { in: recipientIds },
            isActive: true,
          },
        });

        if (recipients.length !== recipientIds.length) {
          throw new Error('Some recipients not found or inactive');
        }

        const transferRecipients = await Promise.all(
          recipients.map(async (recipient, index) => {
            const amount = recipientAmountMap.get(recipient.id);
            const uniqueReference = `${reference}_${index + 1}`;

            try {
              let recipientCode = recipient.paystackRecipientCode;

              if (!recipientCode) {
                recipientCode = await createPaystackRecipient(recipient, c.env);

                await tx.familyMember.update({
                  where: { id: recipient.id },
                  data: { paystackRecipientCode: recipientCode },
                });
              }

              const transferResult = await initiatePaystackTransfer(
                recipientCode,
                amount,
                uniqueReference,
                c.env
              );

              const transferRecipient = await tx.transferRecipient.create({
                data: {
                  transferId: transfer.id,
                  recipientId: recipient.id,
                  amount,
                  status: transferResult.status === 'success' ? 'SUCCESS' : 'PENDING',
                  paystackTransferCode: transferResult.transfer_code,
                  paystackReference: transferResult.reference,
                },
              });

              return {
                ...transferRecipient,
                recipient: {
                  id: recipient.id,
                  name: recipient.name,
                  email: recipient.email,
                },
                paystack: transferResult,
              };

            } catch (error) {
              console.error(`Transfer failed for recipient ${recipient.id}:`, error);

              const failedRecipient = await tx.transferRecipient.create({
                data: {
                  transferId: transfer.id,
                  recipientId: recipient.id,
                  amount,
                  status: 'FAILED',
                  failureReason: (error as Error).message,
                },
              });

              return {
                ...failedRecipient,
                recipient: {
                  id: recipient.id,
                  name: recipient.name,
                  email: recipient.email,
                },
                error: (error as Error).message,
              };
            }
          })
        );

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

        const updatedTransfer = await tx.transferTransaction.update({
          where: { id: transfer.id },
          data: { status: overallStatus },
        });

        return {
          transfer: updatedTransfer,
          recipients: transferRecipients,
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...result.transfer,
            createdAt: result.transfer.createdAt.toISOString(),
            updatedAt: result.transfer.updatedAt.toISOString(),
            recipients: result.recipients.map(r => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
              transferredAt: r.transferredAt?.toISOString() || null,
            })),
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      console.error('Error processing transfer:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: (error as Error).message || 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await prisma.$disconnect();
    }
  }
}
