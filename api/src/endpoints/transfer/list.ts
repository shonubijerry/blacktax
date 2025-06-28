import { OpenAPIRoute } from "chanfana";
import { AppContext, paginationSchema } from "../../types";
import { z } from 'zod';
import { getPrismaClient } from "../../helper";

export class GetTransfers extends OpenAPIRoute {
  schema = {
    tags: ['Transfers'],
    summary: 'Get transfer history',
    request: {
      query: paginationSchema.omit({ search: true }).extend({
        status: z.enum([
          'PENDING',
          'PROCESSING',
          'SUCCESS',
          'FAILED',
          'REVERSED'
        ]).optional()
      })
    },
    responses: {
      '200': {
        description: 'Transfer history',
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>()
    const prisma = getPrismaClient(c.env);

    try {
      const { page = 1, limit = 20, status } = data.query;
      const skip = (page - 1) * limit;

      const where = status ? { status } : {};

      const [transfers, total] = await Promise.all([
        prisma.transferTransaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            recipients: {
              include: {
                recipient: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        }),
        prisma.transferTransaction.count({ where }),
      ]);

      const transformedTransfers = transfers.map(transfer => ({
        ...transfer,
        createdAt: transfer.createdAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
        recipients: transfer.recipients.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          transferredAt: r.transferredAt?.toISOString() || null,
        })),
      }));

      return new Response(JSON.stringify({
        success: true,
        data: transformedTransfers,
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
      console.error('Error fetching transfers:', error);
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
