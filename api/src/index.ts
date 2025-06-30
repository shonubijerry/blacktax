import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { CreateFamilyMember } from './endpoints/family/create'
import { DeleteFamilyMember } from './endpoints/family/delete'
import { GetFamilyMember } from './endpoints/family/get'
import { GetFamilyMembers } from './endpoints/family/list'
import { UpdateFamilyMember } from './endpoints/family/update'
import { ListBanks } from './endpoints/transfer/banks'
import { TransferMoney } from './endpoints/transfer/do'
import { GetTransfers } from './endpoints/transfer/list'
import { AppContext } from './types'
import { handleScheduledEvent } from './crons/schedule'
import { UpdateBulkTransferStatusCron } from './endpoints/cron/status_bulk'
import { UpdateTransferStatusCron } from './endpoints/cron/status'

// Start a Hono app
const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: (origin: string, c: AppContext) => {
      const isProd = c.env.WRANGLER_ENVIRONMENT === 'production';

      if (isProd) {
        return 'https://blacktax.koredujar.workers.dev';
      }

      // Allow localhost in development
      if (origin && origin.startsWith('http://localhost')) {
        return origin;
      }

      return ''; // block other origins
    },
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  }),
)

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: '/',
  schema: {
    info: {
      title: 'Blacktax API',
      version: '2.0.0',
      description:
        'API for managing blacktax accounts and transferring money via Paystack with D1 database',
    },
  },
})

// Register OpenAPI endpoints
openapi.post('/family-members', CreateFamilyMember)
openapi.get('/family-members', GetFamilyMembers)
openapi.get('/family-members/:id', GetFamilyMember)
openapi.put('/family-members/:id', UpdateFamilyMember)
openapi.delete('/family-members/:id', DeleteFamilyMember)
openapi.post('/transfer', TransferMoney)
openapi.get('/transfers', GetTransfers)
openapi.get('/banks', ListBanks)
openapi.get('/cron/transfer/status', UpdateTransferStatusCron)
openapi.get('/cron/transfer/status/bulk', UpdateBulkTransferStatusCron)

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))


// Export the Hono app as the default handler for HTTP requests
// And export a separate handler for scheduled events
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    await handleScheduledEvent(event, env, ctx);
  },
};
