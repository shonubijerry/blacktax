import { OpenAPIRoute } from "chanfana";
import { AppContext, FamilyMemberResponseSchema } from "../../types";
import { z } from 'zod';
import { getPrismaClient } from "../../helper";

export class GetFamilyMember extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Get a family member by ID',
    request: {
      params: z.object({
        id: z.string().describe('Family member ID'),
      })
    },
    responses: {
      '200': {
        description: 'Family member details',
        schema: FamilyMemberResponseSchema,
      },
      '404': {
        description: 'Family member not found',
      },
    },
  };

  async handle(c: AppContext, data: any) {
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
          error: 'Family member not found',
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
      console.error('Error fetching family member:', error);
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