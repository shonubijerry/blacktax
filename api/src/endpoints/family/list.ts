import { Num, OpenAPIRoute, Str } from "chanfana";
import { getPrismaClient, reqJson } from "../../helper";
import { AppContext, FamilyMemberResponseSchema, paginationSchema } from "../../types";
import { z } from 'zod'

export class GetFamilyMembers extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Get all active family members',
    request: {
      params: paginationSchema
    },
    responses: {
      '200': {
        description: 'List of family members',
        schema: z.object({
          success: z.boolean(),
          data: z.array(FamilyMemberResponseSchema),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
        }),
      },
    },
  };

  async handle(c: AppContext, data: any) {
    const prisma = getPrismaClient(c.env);

    try {
      const { page = 1, limit = 20, search } = data.query;
      const skip = (page - 1) * limit;

      const where = {
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }),
      };

      const [members, total] = await Promise.all([
        prisma.familyMember.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.familyMember.count({ where }),
      ]);

      const transformedMembers = members.map(member => ({
        ...member,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      }));

      return new Response(JSON.stringify({
        success: true,
        data: transformedMembers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching family members:', error);
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
