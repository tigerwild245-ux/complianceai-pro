// scripts/enrichSanctionsList.cjs (Corrected Paths)

import fs from 'fs/promises';
import path from 'path';
import { getGroqResponse } from '../services/groqService.js'; // Note the .js extension here

// The list of VIPs who will get LIVE bios (not pre-generated)
const liveBioVIPs = [
  "Putin, Vladimir",
  "Xi Jinping",
  "AL NAHYAN, Mohammed bin Zayed",
];

async function generateBioForPEP(name) {
  const prompt = `
    You are a compliance intelligence assistant. Provide a concise, 2-sentence bio for the following politically exposed person (PEP).
    Focus on their most prominent role and the reason they are internationally recognized.
    Be factual and neutral. If the person is not a well-known public figure, respond with "Insufficient public data for a reliable summary."

    PEP Name: "${name}"

    Bio:
  `;
  try {
    // Add a small delay to avoid rate-limiting
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const bio = await getGroqResponse(prompt);
    return bio.replace(/^"|"$/g, '').replace(/\\n/g, ' ');
  } catch (error) {
    console.error(`Error generating bio for ${name}:`, error);
    return "Could not generate bio.";
  }
}

async function enrichList() {
  console.log("Starting data enrichment process...");
  const sanctionsPath = path.join(process.cwd(), 'server/data/sanctions.json'); // Use process.cwd() for robustness
  const enrichedPath = path.join(process.cwd(), 'server/data/sanctions_enriched.json');

  try {
    const data = await fs.readFile(sanctionsPath, 'utf8');
    const sanctionsList = JSON.parse(data);

    console.log(`Found ${sanctionsList.length} entries to enrich.`);

    for (let i = 0; i < sanctionsList.length; i++) {
      const item = sanctionsList[i];
      console.log(`Processing ${i + 1}/${sanctionsList.length}: ${item.name}`);

      // Only generate a bio if it's not a VIP (they get live bios)
      if (!liveBioVIPs.includes(item.name)) {
        item.bio = await generateBioForPEP(item.name);
      } else {
        item.bio = null; // Mark for live generation
      }
    }

    await fs.writeFile(enrichedPath, JSON.stringify(sanctionsList, null, 2));
    console.log(`✅ Enrichment complete! New file saved to: ${enrichedPath}`);

  } catch (error) {
    console.error("❌ Failed to enrich list:", error);
  }
}

enrichList();
