// CHANGED: New file — asset management with scenario/campaign cache layers
import sql from './db';
import type { ScenarioAsset, CampaignAsset, Scenario } from '@/types';

// Main function — get or generate an image with caching layers
export async function getOrGenerateImage(params: {
  prompt: string;
  type: string;
  tags: string[];
  scenarioId: string;
  campaignId?: string;
  sceneId?: string;
}): Promise<string> {
  const { prompt, tags, scenarioId, campaignId } = params;

  // 1. Check scenario assets (free, shared across all users)
  const scenarioAsset = await findScenarioAsset(scenarioId, tags);
  if (scenarioAsset) return scenarioAsset.url;

  // 2. Check campaign assets (already generated for this user)
  if (campaignId) {
    const campaignAsset = await findCampaignAsset(campaignId, tags);
    if (campaignAsset) return campaignAsset.url;
  }

  // 3. Generate new image
  const url = await generateImageExternal(prompt);

  // Save to campaign assets cache
  if (campaignId) {
    await sql`
      INSERT INTO campaign_assets (campaign_id, scenario_id, type, tags, url, prompt, scene_id)
      VALUES (
        ${campaignId},
        ${scenarioId},
        ${params.type},
        ${sql.array(tags)},
        ${url},
        ${prompt},
        ${params.sceneId ?? null}
      )
    `;
  }

  return url;
}

async function findScenarioAsset(
  scenarioId: string,
  tags: string[]
): Promise<ScenarioAsset | null> {
  const result = await sql`
    SELECT * FROM scenario_assets
    WHERE scenario_id = ${scenarioId} AND tags && ${sql.array(tags)}::text[]
    LIMIT 1
  `;
  return (result[0] as unknown as ScenarioAsset) || null;
}

async function findCampaignAsset(
  campaignId: string,
  tags: string[]
): Promise<CampaignAsset | null> {
  const result = await sql`
    SELECT * FROM campaign_assets
    WHERE campaign_id = ${campaignId} AND tags && ${sql.array(tags)}::text[]
    ORDER BY created_at DESC LIMIT 1
  `;
  return (result[0] as unknown as CampaignAsset) || null;
}

// External image generation — delegates to the existing /api/image logic
// TODO: extract image generation logic from /api/image/route.ts into this module
async function generateImageExternal(prompt: string): Promise<string> {
  // Placeholder — currently image generation happens inline in /api/image route
  // This will be wired up when /api/image is refactored
  throw new Error(`generateImageExternal not yet wired up for prompt: ${prompt}`);
}

// One-time scenario asset generation (admin use)
export async function generateScenarioAssets(
  scenarioId: string,
  scenario: Scenario
): Promise<void> {
  if (!scenario.staticImages) return;

  for (const img of scenario.staticImages) {
    const existing = await findScenarioAsset(scenarioId, [img.id]);
    if (existing) continue;

    const url = await generateImageExternal(img.prompt);
    await sql`
      INSERT INTO scenario_assets (scenario_id, type, tags, url, prompt)
      VALUES (
        ${scenarioId},
        ${img.type},
        ${sql.array([img.id, img.type])},
        ${url},
        ${img.prompt}
      )
    `;
  }
}
