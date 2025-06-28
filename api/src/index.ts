import { fromHono } from "chanfana";
import { Hono } from "hono";
import { CreateFamilyMember } from "./endpoints/family/create";
import { GetFamilyMembers } from "./endpoints/family/list";
import { GetFamilyMember } from "./endpoints/family/get";
import { UpdateFamilyMember } from "./endpoints/family/update";
import { DeleteFamilyMember } from "./endpoints/family/delete";
import { TransferMoney } from "./endpoints/transfer/do";
import { GetTransfers } from "./paystack/list";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: 'Family Money Transfer API',
			version: '2.0.0',
			description: 'API for managing family member accounts and transferring money via Paystack with D1 database',
		},
	},
});

// Register OpenAPI endpoints
openapi.post('/family-members', CreateFamilyMember);
openapi.get('/family-members', GetFamilyMembers);
openapi.get('/family-members/:id', GetFamilyMember);
openapi.put('/family-members/:id', UpdateFamilyMember);
openapi.delete('/family-members/:id', DeleteFamilyMember);
openapi.post('/transfer', TransferMoney);
openapi.get('/transfers', GetTransfers);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;
