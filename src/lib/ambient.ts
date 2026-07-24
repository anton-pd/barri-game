import fs from 'fs';
import path from 'path';
import type { Scenario } from '@/types';
import { trackAPICall } from '@/lib/costTracker';
import { writeScenarioFile, buildAmbientByLocation } from '@/lib/scenarioFiles';
import {
  requireScenarioMutationPermit,
  type ScenarioMutationPermit,
} from '@/lib/scenarioMutationGuard';

const AMBIENT_MODEL = 'eleven_text_to_sound_v2';
const AMBIENT_DURATION_SECONDS = 25;
const AMBIENT_PROMPT_INFLUENCE = 0.55;

interface AmbientTarget {
  kind: 'group' | 'location';
  id: string;
  name: string;
  soundPrompt: string;
  locationIds: string[];
}

export interface AmbientGenerationResult {
  ambientByLocation: Record<string, string>;
  generated: { id: string; kind: 'group' | 'location'; url: string; locationIds: string[] }[];
}

function getAmbientDir(scenarioId: string): string {
  return path.join(process.cwd(), 'public', 'scenarios', scenarioId, 'ambient');
}

function getAmbientPublicUrl(scenarioId: string, targetId: string): string {
  return `/scenarios/${scenarioId}/ambient/${targetId}.mp3`;
}

function getAmbientFilePath(scenarioId: string, targetId: string): string {
  return path.join(getAmbientDir(scenarioId), `${targetId}.mp3`);
}

function buildAmbientPrompt(scenario: Scenario, target: AmbientTarget): string {
  const subject =
    target.kind === 'group'
      ? `Location group "${target.name}" in a ${scenario.era} horror investigation`
      : `Location "${target.name}" in a ${scenario.era} horror investigation`;

  return [
    `${subject}.`,
    'Seamless looping ambient background for tabletop RPG play.',
    target.soundPrompt.trim(),
    'No voices, no speech, no narration, no obvious melody, no stingers.',
    'Only environmental texture and subtle diegetic sounds.',
  ].join(' ');
}

async function generateAmbientAudio(prompt: string): Promise<{ buffer: Buffer; characters: number | undefined }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: prompt,
      loop: true,
      duration_seconds: AMBIENT_DURATION_SECONDS,
      prompt_influence: AMBIENT_PROMPT_INFLUENCE,
      model_id: AMBIENT_MODEL,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs sound-generation failed: ${res.status} ${errorText}`);
  }

  const charactersHeader = res.headers.get('character-cost');
  const characters = charactersHeader ? Number.parseInt(charactersHeader, 10) : undefined;
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), characters };
}

function collectAmbientTargets(scenario: Scenario): AmbientTarget[] {
  const groupedLocationIds = new Set<string>();
  const targets: AmbientTarget[] = [];

  for (const group of scenario.locationGroups ?? []) {
    if (!group.soundPrompt?.trim()) continue;
    for (const locationId of group.locationIds) groupedLocationIds.add(locationId);
    targets.push({
      kind: 'group',
      id: group.id,
      name: group.name,
      soundPrompt: group.soundPrompt,
      locationIds: [...group.locationIds],
    });
  }

  for (const location of scenario.locations ?? []) {
    if (!location.soundPrompt?.trim() || groupedLocationIds.has(location.id)) continue;
    targets.push({
      kind: 'location',
      id: location.id,
      name: location.name,
      soundPrompt: location.soundPrompt,
      locationIds: [location.id],
    });
  }

  return targets;
}

function applyAmbientUrlToScenario(
  scenario: Scenario,
  target: AmbientTarget,
  ambientUrl: string
): boolean {
  let changed = false;

  if (target.kind === 'group') {
    const group = scenario.locationGroups?.find((candidate) => candidate.id === target.id);
    if (group && group.ambientFile !== ambientUrl) {
      group.ambientFile = ambientUrl;
      changed = true;
    }
  }

  for (const locationId of target.locationIds) {
    const location = scenario.locations.find((candidate) => candidate.id === locationId);
    if (location && location.ambientFile !== ambientUrl) {
      location.ambientFile = ambientUrl;
      changed = true;
    }
  }

  return changed;
}

export async function ensureScenarioAmbientGenerated(params: {
  scenarioId: string;
  scenario: Scenario;
  userId?: string;
  persistScenario?: boolean;
  mutationPermit?: ScenarioMutationPermit;
}): Promise<AmbientGenerationResult> {
  const { scenarioId, scenario, userId, persistScenario = true, mutationPermit } = params;
  const permit = persistScenario ? requireScenarioMutationPermit(mutationPermit) : undefined;
  const targets = collectAmbientTargets(scenario);
  const generated: { id: string; kind: 'group' | 'location'; url: string; locationIds: string[] }[] = [];
  let scenarioChanged = false;

  if (targets.length === 0) {
    return { ambientByLocation: buildAmbientByLocation(scenario), generated };
  }

  fs.mkdirSync(getAmbientDir(scenarioId), { recursive: true });

  for (const target of targets) {
    const ambientUrl = getAmbientPublicUrl(scenarioId, target.id);
    const filePath = getAmbientFilePath(scenarioId, target.id);

    if (!fs.existsSync(filePath)) {
      const prompt = buildAmbientPrompt(scenario, target);
      const { buffer, characters } = await generateAmbientAudio(prompt);
      fs.writeFileSync(filePath, buffer);

      if (userId) {
        trackAPICall({
          userId,
          provider: 'elevenlabs',
          type: 'ambient',
          model: AMBIENT_MODEL,
          characters,
        }).catch(console.error);
      }
    }

    if (applyAmbientUrlToScenario(scenario, target, ambientUrl)) {
      scenarioChanged = true;
    }

    generated.push({
      id: target.id,
      kind: target.kind,
      url: ambientUrl,
      locationIds: target.locationIds,
    });
  }

  if (scenarioChanged && permit) {
    writeScenarioFile(scenarioId, scenario, permit);
  }

  return {
    ambientByLocation: buildAmbientByLocation(scenario),
    generated,
  };
}
