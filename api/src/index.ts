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

// Start a Hono app
const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'HTTPS://blacktax.koredujar.workers.dev'],
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

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app
