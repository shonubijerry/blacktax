import { OpenAPIRoute } from "chanfana";
import { getPrismaClient } from "../../helper";
import { z } from 'zod';
import { AppContext } from "../../types";

export class DeleteFamilyMember extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Deactivate a blacktax recipient',
    request: {
      params: z.object({
        id: z.string().describe('Blacktax recipient ID'),
      }),
    },
    responses: {
      '200': {
        description: 'Blacktax recipient deactivated successfully',
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

      const existingMember = await prisma.familyMember.findUnique({
        where: { id, isActive: true }
      });

      if (!existingMember) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Blacktax recipient not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await prisma.familyMember.update({
        where: { id },
        data: { isActive: false },
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Blacktax recipient deactivated successfully',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error deactivating blacktax recipient:', error);
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