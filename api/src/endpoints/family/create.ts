import { OpenAPIRoute } from "chanfana";
import { AppContext, FamilyMemberCreateSchema, FamilyMemberResponseSchema } from "../../types";
import { getPrismaClient, reqJson } from "../../helper";
import { Context } from "hono";
import { Prisma } from "../../generated/prisma";

export class CreateFamilyMember extends OpenAPIRoute {
  schema = {
    tags: ['Family Members'],
    summary: 'Create a new family member',
    request: {
      body: reqJson(FamilyMemberCreateSchema),
    },
    responses: {
      '201': {
        description: 'Family member created successfully',
        schema: FamilyMemberResponseSchema,
      },
      '400': {
        description: 'Invalid request data',
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>()
    const prisma = getPrismaClient(c.env);

    try {
      const memberData = data.body

      // Check if email already exists
      const existingMember = await prisma.familyMember.findUnique({
        where: { email: memberData.email }
      });

      if (existingMember) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Family member with this email already exists',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const familyMember = await prisma.familyMember.create({
        data: memberData as Prisma.FamilyMemberCreateInput,
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...familyMember,
          createdAt: familyMember.createdAt.toISOString(),
          updatedAt: familyMember.updatedAt.toISOString(),
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating family member:', error);
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