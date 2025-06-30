// scheduler.ts - Cron job router/handler
import { UpdateTransferStatusCron } from '../endpoints/cron/status'
import { UpdateBulkTransferStatusCron } from '../endpoints/cron/status_bulk'
import { AppContext } from '../types'

async function runFrequentStatusUpdate(context: AppContext) {
  const cronHandler = new UpdateTransferStatusCron(null)
  // Override to only check very recent transfers (last 30 minutes)
  return await cronHandler.handle(context)
}

async function runBulkStatusUpdate(context: AppContext) {
  const cronHandler = new UpdateBulkTransferStatusCron(null)
  return await cronHandler.handle(context)
}

export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: any,
  ctx: ExecutionContext,
): Promise<void> {
  // Create context similar to your regular API context
  const context: AppContext = {
    env,
    executionCtx: ctx,
    // Add other context properties as needed
  } as AppContext

  try {
    switch (event.cron) {
      case '0 23 24 * *': // At 23:00 on day-of-month 24.
        console.log('Running frequent transfer status update...')
        await runFrequentStatusUpdate(context)
        break

      case '0 0 15 * *': // At 00:00 on day-of-month 15.
        console.log('Running bulk transfer status update...')
        await runBulkStatusUpdate(context)
        break

      default:
        console.log('Unknown cron trigger:', event.cron)
    }
  } catch (error) {
    console.error('Error in scheduled event:', error)
    // You might want to send alerts here
  }
}
