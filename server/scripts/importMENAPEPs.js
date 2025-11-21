// server/scripts/importMENAPEPs.js
// Import pre-filtered MENA PEPs from CSV

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

    // Convert to database format
    const pep = {
      name: row.name || '',
      aliases: row.name || '', // Use name as alias for now
      country: COUNTRY_NAMES[row.primary_country] || row.primary_country || 'Unknown',
      position: row.caption || 'Politically Exposed Person',
      pep_level: determinePEPLevel(row.caption),
      risk_category: 'MEDIUM',
      source: row.dataset || 'OpenSanctions',
      source_url: `https://opensanctions.org/entities/${row.name?.toLowerCase().replace(/\s+/g, '-')}`,
      last_updated: row.last_seen || new Date().toISOString().split('T')[0]
    };

    if (pep.name) {
      peps.push(pep);
    }
  }

  return peps;
}

function determinePEPLevel(caption) {
  if (!caption) return 'MEDIUM';
  
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
  
  // Local level positions
  if (lowerCaption.includes('member') ||
      lowerCaption.includes('deputy') ||
      lowerCaption.includes('council')) {
    return 'LOCAL';
  }
  
  return 'MEDIUM';
}

async function importPEPs(csvPath) {
  console.log('\n🔄 Starting MENA PEP Import...\n');
  
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
    countryStats[pep.country] = (countryStats[pep.country] || 0) + 1;
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

  for (let i = 0; i < peps.length; i += BATCH_SIZE) {
    const batch = peps.slice(i, i + BATCH_SIZE);
    
    try {
      const { data, error } = await supabase
        .from('peps')
        .upsert(batch, { 
          onConflict: 'name',
          ignoreDuplicates: true 
        });

      if (error) {
        if (error.code === '23505') { // Duplicate key
          skipped += batch.length;
        } else {
          console.error(`❌ Error in batch ${i / BATCH_SIZE + 1}:`, error.message);
        }
      } else {
        imported += batch.length;
      }

      // Progress indicator
      const progress = Math.min(100, ((i + BATCH_SIZE) / peps.length) * 100);
      process.stdout.write(`\r⏳ Progress: ${progress.toFixed(1)}% (${imported.toLocaleString()} imported, ${skipped.toLocaleString()} skipped)`);
      
    } catch (err) {
      console.error(`\n❌ Unexpected error:`, err.message);
    }
  }

  console.log('\n\n✅ Import Complete!');
  console.log(`📊 Total processed: ${peps.length.toLocaleString()}`);
  console.log(`✅ Imported: ${imported.toLocaleString()}`);
  console.log(`⏭️  Skipped (duplicates): ${skipped.toLocaleString()}`);
  
  console.log('\n🔄 Next Steps:');
  console.log('  1. Clear cache: curl -X POST http://localhost:5000/api/admin/clear-cache');
  console.log('  2. Test Arabic search: curl -X POST -H "Content-Type: application/json" -d \'{"name":"مصطفى مدبولي"}\' http://localhost:5000/api/screen');
}

// Main execution
const csvPath = process.argv[2] || path.join(__dirname, '../../data/mena_arab_peps_sorted.csv');

console.log('\n' + '='.repeat(60));
console.log('  MENA PEP Importer - Node.js');
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
