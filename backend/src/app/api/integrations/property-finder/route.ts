import { integrationRoutes } from "@/lib/api/integration-route";

/**
 * GET  /api/integrations/property-finder — configuration status + last run
 * POST /api/integrations/property-finder — { records?: [...], dryRun?, defaultAgentId? }
 *      With `records`, imports them; without, fetches PROPERTY_FINDER_FEED_URL.
 */
export const { GET, POST } = integrationRoutes("PROPERTY_FINDER");
