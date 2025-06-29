import { OpenAPIRoute } from "chanfana";
import { AppContext, FamilyMemberResponseSchema } from "../../types";
import { z } from 'zod';
import { getPrismaClient } from "../../helper";

export class GetFamilyMember extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Get a blacktax recipient by ID',
    request: {
      params: z.object({
        id: z.string().describe('Blacktax recipient ID'),
      })
    },
    responses: {
      '200': {
        description: 'Blacktax recipient details',
        schema: FamilyMemberResponseSchema,
      },
      '404': {
        description: 'Blacktax recipient not found',
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>()
    const prisma = getPrismaClient(c.env);

    try {
      const { id } = data.params;

      const member = await prisma.familyMember.findUnique({
        where: { id, isActive: true },
        include: {
          receivedTransfers: {
            include: {
              transfer: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!member) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Blacktax recipient not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...member,
          createdAt: member.createdAt.toISOString(),
          updatedAt: member.updatedAt.toISOString(),
          receivedTransfers: member.receivedTransfers.map(rt => ({
            ...rt,
            createdAt: rt.createdAt.toISOString(),
            updatedAt: rt.updatedAt.toISOString(),
            transferredAt: rt.transferredAt?.toISOString() || null,
          })),
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching blacktax recipient:', error);
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