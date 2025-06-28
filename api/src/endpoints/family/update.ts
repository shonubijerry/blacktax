import { OpenAPIRoute } from "chanfana";
import { AppContext, FamilyMemberResponseSchema, FamilyMemberUpdateSchema } from "../../types";
import { getPrismaClient, reqJson } from "../../helper";
import { z } from 'zod';

export class UpdateFamilyMember extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Update a family member',
    request: {
      params: z.object({
        id: z.string().describe('Family member ID'),
      }),
      body: reqJson(FamilyMemberUpdateSchema)
    },
    responses: {
      '200': {
        description: 'Family member updated successfully',
        schema: FamilyMemberResponseSchema,
      },
      '404': {
        description: 'Family member not found',
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>()
    const prisma = getPrismaClient(c.env);

    try {
      const { id } = data.params;
      const updateData = data.body;

      // Check if member exists
      const existingMember = await prisma.familyMember.findUnique({
        where: { id, isActive: true }
      });

      if (!existingMember) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Family member not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // If email is being updated, check for duplicates
      if (updateData.email && updateData.email !== existingMember.email) {
        const emailExists = await prisma.familyMember.findUnique({
          where: { email: updateData.email }
        });

        if (emailExists) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Email already exists',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // If bank details changed, reset Paystack recipient code
      if (updateData.accountNumber || updateData.bankCode) {
        updateData.paystackRecipientCode = null;
      }

      const updatedMember = await prisma.familyMember.update({
        where: { id },
        data: updateData,
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...updatedMember,
          createdAt: updatedMember.createdAt.toISOString(),
          updatedAt: updatedMember.updatedAt.toISOString(),
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error updating family member:', error);
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