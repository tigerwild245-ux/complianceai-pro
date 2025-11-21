// server/scripts/importMENAPEPs_v2.js
// Import MENA PEPs into existing sanctions_list table

const supabase = require('../config/supabaseClient');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Country code to name mapping
const COUNTRY_NAMES = {
  'EG': 'Egypt', 'SA': 'Saudi Arabia', 'AE': 'UAE', 'JO': 'Jordan',
  'LB': 'Lebanon', 'MA': 'Morocco', 'TN': 'Tunisia', 'DZ': 'Algeria',
  'IQ': 'Iraq', 'SY': 'Syria', 'YE': 'Yemen', 'LY': 'Libya',
  'SD': 'Sudan', 'OM': 'Oman', 'KW': 'Kuwait', 'QA': 'Qatar',
  'BH': 'Bahrain', 'PS': 'Palestine', 'SO': 'Somalia', 'DJ': 'Djibouti',
  'KM': 'Comoros', 'MR': 'Mauritania', 'IR': 'Iran', 'TR': 'Turkey'
};

async function parseCSV(filePath) {
  const peps = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];
  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      headers = line.split(',').map(h => h.trim().replace(/"/g, ''));
      isFirstLine = false;
      continue;
    }

    // Parse CSV line (handle quotes)
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    // Create object from headers and values
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Convert to sanctions_list format
    const entity = {
      entity_name: row.name || '',
      entity_type: 'Person',
      first_name: extractFirstName(row.name),
      last_name: extractLastName(row.name),
      list_source: 'OpenSanctions - MENA PEPs',
      program: 'PEP - Politically Exposed Person',
      is_pep: true,  // Mark as PEP
      pep_level: determinePEPLevel(row.caption),
      position: row.caption || 'Politically Exposed Person',
      jurisdiction: COUNTRY_NAMES[row.primary_country] || row.primary_country || 'Unknown',
      nationalities: row.countries ? [COUNTRY_NAMES[row.primary_country] || row.primary_country] : null,
      aliases: row.name ? [row.name] : null,  // Store original name as alias
      remarks: `Imported from OpenSanctions MENA dataset. Last seen: ${row.last_seen || 'N/A'}`,
      searchable_text: buildSearchableText(row)
    };

    if (entity.entity_name) {
      peps.push(entity);
    }
  }

  return peps;
}

function extractFirstName(fullName) {
  if (!fullName) return null;
  const parts = fullName.trim().split(' ');
  return parts[0] || null;
}

function extractLastName(fullName) {
  if (!fullName) return null;
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

function buildSearchableText(row) {
  const parts = [
    row.name,
    row.caption,
    row.primary_country,
    row.countries
  ].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

function determinePEPLevel(caption) {
  if (!caption) return 'LOCAL';
  
  const lowerCaption = caption.toLowerCase();
  
  // National level positions
  if (lowerCaption.includes('president') || 
      lowerCaption.includes('prime minister') ||
      lowerCaption.includes('minister') ||
      lowerCaption.includes('speaker')) {
    return 'NATIONAL';
  }
  
  // Regional level positions
  if (lowerCaption.includes('governor') ||
      lowerCaption.includes('mayor') ||
      lowerCaption.includes('ambassador')) {
    return 'REGIONAL';
  }
  
  return 'LOCAL';
}

async function importPEPs(csvPath) {
  console.log('\n🔄 Starting MENA PEP Import to sanctions_list table...\n');
  
  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    console.error('Run the Python filter script first: python3 scripts/filter_mena_peps.py');
    process.exit(1);
  }

  // Parse CSV
  console.log('📖 Reading CSV file...');
  const peps = await parseCSV(csvPath);
  
  console.log(`✅ Parsed ${peps.length.toLocaleString()} PEPs\n`);

  // Show statistics
  const countryStats = {};
  const levelStats = {};
  
  peps.forEach(pep => {
    countryStats[pep.jurisdiction] = (countryStats[pep.jurisdiction] || 0) + 1;
    levelStats[pep.pep_level] = (levelStats[pep.pep_level] || 0) + 1;
  });

  console.log('📊 Country Distribution:');
  Object.entries(countryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([country, count]) => {
      console.log(`  ${country}: ${count.toLocaleString()}`);
    });

  console.log('\n📊 PEP Level Distribution:');
  Object.entries(levelStats).forEach(([level, count]) => {
    console.log(`  ${level}: ${count.toLocaleString()}`);
  });

  console.log('\n⏳ Starting import in 5 seconds... (Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Import in batches
  const BATCH_SIZE = 500;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < peps.length; i += BATCH_SIZE) {
    const batch = peps.slice(i, i + BATCH_SIZE);
    
    try {
      const { data, error } = await supabase
        .from('sanctions_list')
        .insert(batch);

      if (error) {
        if (error.code === '23505') { // Duplicate key
          skipped += batch.length;
        } else {
          console.error(`\n❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
          errors += batch.length;
        }
      } else {
        imported += batch.length;
      }

      // Progress indicator
      const progress = Math.min(100, ((i + BATCH_SIZE) / peps.length) * 100);
      process.stdout.write(`\r⏳ Progress: ${progress.toFixed(1)}% (${imported.toLocaleString()} imported, ${skipped.toLocaleString()} skipped, ${errors.toLocaleString()} errors)`);
      
    } catch (err) {
      console.error(`\n❌ Unexpected error:`, err.message);
      errors += batch.length;
    }
  }

  console.log('\n\n✅ Import Complete!');
  console.log(`📊 Total processed: ${peps.length.toLocaleString()}`);
  console.log(`✅ Imported: ${imported.toLocaleString()}`);
  console.log(`⏭️  Skipped (duplicates): ${skipped.toLocaleString()}`);
  console.log(`❌ Errors: ${errors.toLocaleString()}`);
  
  console.log('\n🔄 Next Steps:');
  console.log('  1. Verify data: SELECT COUNT(*) FROM sanctions_list WHERE is_pep = true;');
  console.log('  2. Test search with Egyptian PM: مصطفى مدبولي');
  console.log('  3. Clear application cache if needed');
}

// Main execution
const csvPath = process.argv[2] || path.join(__dirname, '../../data/mena_arab_peps_sorted.csv');

console.log('\n' + '='.repeat(60));
console.log('  MENA PEP Importer → sanctions_list Table');
console.log('='.repeat(60));
console.log(`\n📁 CSV Path: ${csvPath}\n`);

importPEPs(csvPath)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
