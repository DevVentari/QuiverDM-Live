/**
 * Discover DDB campaign names for known campaign IDs and link + import characters.
 * Usage: npx tsx scripts/ddb-discover-campaigns.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

const COBALT = process.env.DDB_COBALT_SESSION;
const DATABASE_URL = process.env.DATABASE_URL;

if (!COBALT) {
  console.error('DDB_COBALT_SESSION not set — run npm run ddb:refresh first');
  process.exit(1);
}

const TARGET_IDS = ['6021147', '6811442'];

async function getDDBBearerToken(cobalt: string): Promise<string | null> {
  const res = await fetch('https://auth-service.dndbeyond.com/v1/cobalt-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `CobaltSession=${cobalt}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.token ?? null;
}

async function main() {
  console.log('Getting DDB bearer token...');
  const bearer = await getDDBBearerToken(COBALT!);
  if (!bearer) {
    console.error('Failed to get bearer token — CobaltSession may be expired');
    console.error('Run: npm run ddb:refresh');
    process.exit(1);
  }

  console.log('Fetching user campaigns from DDB...');
  const res = await fetch('https://www.dndbeyond.com/api/campaign/stt/user-campaigns', {
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Cookie: `CobaltSession=${COBALT}`,
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!res.ok) {
    console.error(`DDB API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const json = await res.json();
  const campaigns: any[] = json.data ?? [];

  console.log(`\nAll DDB campaigns (${campaigns.length} total):`);
  for (const c of campaigns) {
    const marker = TARGET_IDS.includes(String(c.id)) ? ' ◄ TARGET' : '';
    console.log(`  [${c.id}] ${c.name ?? c.campaignName ?? '(no name)'}${marker}`);
  }

  const found = campaigns.filter((c: any) => TARGET_IDS.includes(String(c.id)));
  if (found.length === 0) {
    console.log('\nNeither target campaign ID found in this DDB account.');
    console.log('Campaigns may belong to a different DDB account.');
  } else {
    console.log('\nTarget campaigns:');
    for (const c of found) {
      console.log(`  DDB ${c.id} → "${c.name ?? c.campaignName}"`);
    }
    console.log('\nNext step: Link each campaign in the Players page of the matching QuiverDM campaign,');
    console.log('then click "Sync DDB" to import characters.');
  }
}

main().catch(console.error);
