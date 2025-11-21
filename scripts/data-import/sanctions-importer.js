import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --- Configuration Constants (From Python Snippet) ---
const CONFIG = {
  BATCH_SIZE: 1000,        // Supabase batch insert limit
  MAX_MEMORY_PERCENT: 85,  // Max memory usage trigger (informational in Node)
};

const SOURCES = {
  'opensanctions_peps': {
    name: 'OpenSanctions PEPs',
    url: 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json',
    is_pep: true,
    type: 'opensanctions'
  },
  'un': {
    name: 'UN Consolidated List', 
    url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    is_pep: false,
    type: 'un'
  },
  'ofac': {
    name: 'OFAC SDN List',
    type: 'ofac'
  },
  'mlcu': {
    name: 'Egypt MLCU',
    type: 'mlcu'
  }
};

// --- Unified Data Structure ---
class SanctionEntity {
  constructor(data) {
    this.entity_name = data.entity_name || '';
    this.entity_type = data.entity_type || 'individual';
    this.aliases = data.aliases || [];
    this.addresses = data.addresses || [];
    this.nationalities = data.nationalities || [];
    this.date_of_birth = data.date_of_birth || null;
    this.place_of_birth = data.place_of_birth || null;
    this.identification_numbers = data.identification_numbers || [];
    this.list_source = data.list_source || '';
    this.program = data.program || '';
    this.date_listed = data.date_listed || null;
    this.is_pep = data.is_pep || false; // Added based on Python snippet
    this.raw_data = data.raw_data || {};
  }
}

// --- Parsers ---

class OFACParser {
  static parse(csvData) {
    return csvData.map(row => new SanctionEntity({
      entity_name: row.name || row.NAME || row['SDN Name'],
      entity_type: (row.type || row.TYPE)?.toLowerCase() === 'entity' ? 'entity' : 'individual',
      aliases: this.parseAliases(row.aliases || row.ALIASES || row['Alt Names']),
      addresses: this.parseAddresses(row.address || row.ADDRESS),
      nationalities: this.parseNationalities(row.nationality || row.NATIONALITY || row.citizenship),
      date_of_birth: this.parseDate(row.dob || row['Date of Birth']),
      identification_numbers: this.parseIDs(row.id_number || row['ID Number']),
      list_source: 'OFAC',
      program: row.program || row.PROGRAM || 'SDN',
      date_listed: this.parseDate(row.date_listed || row['Date Listed']),
      is_pep: false,
      raw_data: row
    }));
  }
  
  static parseAliases(aliasStr) {
    if (!aliasStr) return [];
    return aliasStr.split(/[;,]/).map(a => a.trim()).filter(Boolean);
  }
  
  static parseAddresses(addressStr) {
    if (!addressStr) return [];
    return [addressStr.trim()];
  }
  
  static parseNationalities(natStr) {
    if (!natStr) return [];
    return natStr.split(/[;,]/).map(n => n.trim()).filter(Boolean);
  }
  
  static parseIDs(idStr) {
    if (!idStr) return [];
    return [idStr.trim()];
  }
  
  static parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
}

class OpenSanctionsParser {
  static parse(jsonData) {
    // Handles OpenSanctions format (Array of objects)
    const entities = [];
    
    jsonData.forEach(item => {
      // OpenSanctions schema usually has 'caption' as name, 'properties' for details
      const props = item.properties || {};
      const schema = item.schema;

      const entity = new SanctionEntity({
        entity_name: item.caption || props.name?.[0],
        entity_type: schema === 'Company' || schema === 'Organization' ? 'entity' : 'individual',
        aliases: props.alias || [],
        addresses: props.address || [],
        nationalities: props.nationality || props.country || [],
        date_of_birth: props.birthDate?.[0] || null,
        list_source: 'OpenSanctions',
        program: item.dataset || 'PEPs',
        is_pep: true,
        raw_data: item
      });
      entities.push(entity);
    });
    
    return entities;
  }
}

class MLCUParser {
  static parse(csvData) {
    return csvData.map(row => new SanctionEntity({
      entity_name: row['الاسم'] || row['Name'] || row.name,
      entity_type: this.determineType(row),
      aliases: this.parseArabicAliases(row['أسماء أخرى'] || row.aliases),
      nationalities: ['EG'],
      list_source: 'MLCU',
      program: 'Egypt Terror List',
      date_listed: this.parseDate(row['تاريخ الإدراج'] || row.date),
      is_pep: false,
      raw_data: row
    }));
  }
  
  static determineType(row) {
    const typeField = row['النوع'] || row.type || '';
    if (typeField.includes('كيان') || typeField.toLowerCase().includes('entity')) {
      return 'entity';
    }
    return 'individual';
  }
  
  static parseArabicAliases(aliasStr) {
    if (!aliasStr) return [];
    return aliasStr.split(/[،,;]/).map(a => a.trim()).filter(Boolean);
  }
  
  static parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
}

// --- Main Importer Class ---
class SanctionsImporter {
  
  /**
   * 🧹 Clean and deduplicate data (Ported from Python)
   * Memory efficient deduplication using Set
   */
  static cleanData(records) {
    console.log(`🧹 Cleaning ${records.length.toLocaleString()} records...`);
    
    if (!records || records.length === 0) return [];

    const initialCount = records.length;
    const seen = new Set();
    const cleanedRecords = [];

    for (const record of records) {
      // Use entity_name as unique key (normalized)
      const name = record.entity_name ? String(record.entity_name).trim().toLowerCase() : '';
      
      if (name && !seen.has(name)) {
        seen.add(name);
        
        // Clean null/undefined/'nan' values inside the record
        const cleanRecord = { ...record };
        Object.keys(cleanRecord).forEach(key => {
          const val = cleanRecord[key];
          if (val === null || val === undefined || val === 'nan' || (typeof val === 'number' && isNaN(val))) {
            cleanRecord[key] = null;
          }
        });

        cleanedRecords.push(cleanRecord);
      }
    }

    const dedupedCount = cleanedRecords.length;
    const removed = initialCount - dedupedCount;
    console.log(`Deduplicated: ${initialCount.toLocaleString()} → ${dedupedCount.toLocaleString()} (-${removed.toLocaleString()})`);
    console.log(`✅ ${dedupedCount.toLocaleString()} records ready for import`);
    
    return cleanedRecords;
  }

  static async importFromCSV(filePath, parserClass) {
    const results = [];
    console.log(`Reading CSV from: ${filePath}`);
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            // 1. Parse raw data into Entities
            const entities = parserClass.parse(results);
            // 2. Clean and Deduplicate (New Step)
            const cleanedEntities = this.cleanData(entities);
            // 3. Bulk Insert
            await this.bulkInsert(cleanedEntities);
            resolve(cleanedEntities.length);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }
  
  static async importFromJson(filePath, parserClass) {
    console.log(`Reading JSON from: ${filePath}`);
    // For large JSON files, consider using a stream parser like 'stream-json'
    // For now, reading file into memory as per existing structure
    const rawData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);
    
    const entities = parserClass.parse(jsonData);
    const cleanedEntities = this.cleanData(entities);
    
    await this.bulkInsert(cleanedEntities);
    return cleanedEntities.length;
  }

  static async importFromExcel(filePath, parserClass) {
    console.log(`Reading Excel from: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const entities = parserClass.parse(data);
    const cleanedEntities = this.cleanData(entities);
    
    await this.bulkInsert(cleanedEntities);
    return cleanedEntities.length;
  }
  
  static async bulkInsert(entities) {
    const batchSize = CONFIG.BATCH_SIZE; // Used from Config
    const totalBatches = Math.ceil(entities.length / batchSize);
    
    console.log(`Starting Bulk Insert of ${entities.length} records in ${totalBatches} batches...`);

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('sanctions_list')
        .upsert(batch, { onConflict: 'entity_name', ignoreDuplicates: true }); 
        // Changed to 'upsert' to handle re-runs better, 
        // requires a unique constraint on entity_name or handling duplicates
      
      if (error) {
        console.error(`❌ Batch insert error (Batch ${Math.floor(i / batchSize) + 1}):`, error.message);
        // Optional: Don't throw immediately, allow other batches to proceed?
        // throw error; 
      } else {
        process.stdout.write(`\rInserted batch ${Math.floor(i / batchSize) + 1}/${totalBatches}`);
      }
    }
    console.log('\nInsert complete.');
  }
  
  static async clearDatabase() {
    console.log('⚠️ Clearing Database...');
    const { error } = await supabase
      .from('sanctions_list')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows
    
    if (error) throw error;
    console.log('✅ Database cleared');
  }
}

// --- CLI Interface ---
const args = process.argv.slice(2);
const command = args[0];
const filePath = args[1];

async function main() {
  try {
    if (!command) {
       throw new Error('No command provided');
    }

    switch (command) {
      case 'import-ofac':
        if (!filePath) throw new Error('File path required for OFAC import');
        await SanctionsImporter.importFromCSV(filePath, OFACParser);
        break;
        
      case 'import-peps':
        console.log(`Importing OpenSanctions PEPs (Source: ${SOURCES.opensanctions_peps.url})`);
        if (!filePath) throw new Error('File path required (Download JSON first)');
        // Usage: node sanctions-importer.js import-peps ./peps.json
        await SanctionsImporter.importFromJson(filePath, OpenSanctionsParser);
        break;
        
      case 'import-mlcu':
        if (!filePath) throw new Error('File path required for MLCU import');
        await SanctionsImporter.importFromCSV(filePath, MLCUParser);
        break;
        
      case 'clear':
        await SanctionsImporter.clearDatabase();
        break;
        
      default:
        console.log(`
  🌍 Compliance AI Importer Tool
  ------------------------------
  Usage:
    node sanctions-importer.js import-ofac <path-to-csv>
    node sanctions-importer.js import-peps <path-to-json>
    node sanctions-importer.js import-mlcu <path-to-csv>
    node sanctions-importer.js clear
        `);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();