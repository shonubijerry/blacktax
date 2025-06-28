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
      body: reqJson(TransferRequestSchema)
    },
    responses: {
      '200': {
        description: 'Transfer initiated successfully',
      },
      '400': {
        description: 'Invalid request data',
      },
    },
  };

  async handle(c: AppContext, data: any) {
    const prisma = getPrismaClient(c.env);
    
    try {
      const transferData = data.body;
      
      // Validate that recipient_ids and amounts arrays have same length
      if (transferData.recipientIds.length !== transferData.amounts.length) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Recipients and amounts arrays must have the same length',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const reference = transferData.reference || generateReference();
      const totalAmount = transferData.amounts.reduce((sum, amount) => sum + amount, 0);

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create transfer transaction record
        const transfer = await tx.transferTransaction.create({
          data: {
            reference,
            totalAmount,
            callbackUrl: transferData.callbackUrl,
            description: transferData.description,
          },
        });

        // Get all recipients
        const recipients = await tx.familyMember.findMany({
          where: {
            id: { in: transferData.recipientIds },
            isActive: true,
          },
        });

        if (recipients.length !== transferData.recipientIds.length) {
          throw new Error('Some recipients not found or inactive');
        }

        const transferRecipients = [];

        // Process each recipient
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          const amount = transferData.amounts[i];

          try {
            // Get or create Paystack recipient code
            let recipientCode = recipient.paystackRecipientCode;
            if (!recipientCode) {
              recipientCode = await createPaystackRecipient(recipient, c.env);
              
              // Update the recipient code in database
              await tx.familyMember.update({
                where: { id: recipient.id },
                data: { paystackRecipientCode: recipientCode },
              });
            }

            // Initiate Paystack transfer
            const transferResult = await initiatePaystackTransfer(
              recipientCode,
              amount,
              `${reference}_${i + 1}`,
              c.env
            );

            // Create transfer recipient record
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

            transferRecipients.push({
              ...transferRecipient,
              recipient: {
                id: recipient.id,
                name: recipient.name,
                email: recipient.email,
              },
              paystack: transferResult,
            });

          } catch (transferError) {
            console.error(`Transfer failed for recipient ${recipient.id}:`, transferError);
            
            // Create failed transfer recipient record
            const failedTransferRecipient = await tx.transferRecipient.create({
              data: {
                transferId: transfer.id,
                recipientId: recipient.id,
                amount,
                status: 'FAILED',
                failureReason: (transferError as Error).message,
              },
            });

            transferRecipients.push({
              ...failedTransferRecipient,
              recipient: {
                id: recipient.id,
                name: recipient.name,
                email: recipient.email,
              },
              error: (transferError as Error).message,
            });
          }
        }

        // Update transfer status based on results
        const successCount = transferRecipients.filter(tr => tr.status === 'SUCCESS').length;
        const failedCount = transferRecipients.filter(tr => tr.status === 'FAILED').length;
        
        let transferStatus: $Enums.TransferStatus = 'PENDING' as const;
        if (successCount === transferRecipients.length) {
          transferStatus = 'SUCCESS' as const;
        } else if (failedCount === transferRecipients.length) {
          transferStatus = 'FAILED';
        } else {
          transferStatus = 'PROCESSING';
        }

        const updatedTransfer = await tx.transferTransaction.update({
          where: { id: transfer.id },
          data: { status: transferStatus },
        });

        return {
          transfer: updatedTransfer,
          recipients: transferRecipients,
        };
      });

      return new Response(JSON.stringify({
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
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error processing transfer:', error);
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message || 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}