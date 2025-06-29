import { OpenAPIRoute } from 'chanfana'
import { getPrismaClient } from '../../helper'
import { AppContext, BankSchema } from '../../types'

export class ListBanks extends OpenAPIRoute {
  schema = {
    tags: ['Transfers'],
    summary: 'Fetch banks',
    request: {},
    responses: {
      '200': {
        description: 'List of banks',
        schema: BankSchema.array(),
      },
    },
  }

  async handle(c: AppContext) {
    const prisma = getPrismaClient(c.env)

    return new Response(
      JSON.stringify({
        success: true,
        data: await prisma.bank.findMany({}),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
