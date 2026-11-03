import { integrationRoutes } from "@/lib/api/integration-route";

/**
 * GET  /api/integrations/qatar-living — configuration status + last run
 * POST /api/integrations/qatar-living — { records?: [...], dryRun?, defaultAgentId? }
 *      With `records`, imports them; without, fetches QATAR_LIVING_FEED_URL.
 */
export const { GET, POST } = integrationRoutes("QATAR_LIVING");
