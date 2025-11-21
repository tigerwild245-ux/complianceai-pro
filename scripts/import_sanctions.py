#!/usr/bin/env python3
"""
Memory-Optimized Sanctions Data Importer with Batch Processing
Downloads, parses, and imports global sanctions data into Supabase with minimal memory usage
"""

import sys
import os
import json
import time
import gc
import logging
import warnings
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from enum import Enum

# Fix Pandas warnings
import pandas as pd
import numpy as np
import psutil
import requests
import xml.etree.ElementTree as ET
import csv
import re

# Supabase client
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.FileHandler('sanctions_import.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Suppress specific warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=pd.errors.SettingWithCopyWarning)
warnings.filterwarnings('ignore', category=ResourceWarning)
pd.options.mode.chained_assignment = None

# Load environment variables from root directory
load_dotenv('/workspaces/complianceai-pro/.env')

# Directory paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data-import"
DATA_DIR.mkdir(exist_ok=True)

class DataSource(Enum):
    UN = "un"
    OFAC = "ofac"
    PEP = "pep"

class SanctionsImporter:
    """Memory-Optimized Sanctions Data Importer for Supabase"""
    
    BATCH_SIZE = 1000  # Supabase batch insert limit
    DOWNLOAD_BATCH_SIZE = 50000  # Process records in chunks during download
    MAX_MEMORY_PERCENT = 85  # Maximum memory usage before forcing garbage collection
    
    def __init__(self):
        self.total_imported = 0
        self.records_processed = 0
        self.start_time = None
        
        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        logger.info("✅ Supabase client initialized")
        
        # Data source URLs
        self.sources = {
            'un': {
                'name': 'UN Consolidated List',
                'url': 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
                'type': DataSource.UN
            },
            'ofac': {
                'name': 'OFAC SDN List',
                'urls': {
                    'sdn': 'https://www.treasury.gov/ofac/downloads/sdn.csv',
                    'alt': 'https://www.treasury.gov/ofac/downloads/alt.csv',
                    'add': 'https://www.treasury.gov/ofac/downloads/add.csv'
                },
                'type': DataSource.OFAC
            },
            'pep': {
                'name': 'OpenSanctions PEPs (MENA)',
                'url': 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json',
                'type': DataSource.PEP,
                'target_countries': {
                    'EG', 'EGYPT',           # Egypt
                    'AE', 'UAE', 'EMIRATES', # UAE
                    'SA', 'SAUDI',           # Saudi Arabia
                    'KW', 'KUWAIT',          # Kuwait
                    'QA', 'QATAR',           # Qatar
                    'BH', 'BAHRAIN',         # Bahrain
                    'OM', 'OMAN',            # Oman
                    'JO', 'JORDAN',          # Jordan
                    'LB', 'LEBANON'          # Lebanon
                }
            }
        }
    
    def check_memory_usage(self):
        """Monitor memory usage and trigger garbage collection if needed"""
        try:
            memory_percent = psutil.virtual_memory().percent
            if memory_percent > self.MAX_MEMORY_PERCENT:
                logger.warning(f"MemoryWarning High memory usage: {memory_percent}% - forcing garbage collection")
                gc.collect()
                # Log memory stats after collection
                mem = psutil.virtual_memory()
                logger.info(f"MemoryWarning Memory after GC: {mem.percent}% used, {mem.available / 1024**3:.2f}GB available")
        except Exception as e:
            logger.error(f"Error checking memory usage: {e}")
    
    def clean_data(self, records: List[Dict[str, Any]], source_key: str) -> List[Dict[str, Any]]:
        """🧹 Clean and deduplicate data in a memory-efficient way."""
        logger.info(f"🧹 Cleaning {len(records):,} {self.sources[source_key]['name']} records...")
        
        if not records:
            return []
        
        initial_count = len(records)
        
        # Use a set to track seen entity names to avoid duplicates
        seen = set()
        cleaned_records = []
        
        for record in records:
            # Use 'entity_name' field as the unique key for deduplication
            record_key = record.get('entity_name', '').strip().lower()
            if not record_key:
                continue
                
            if record_key not in seen:
                seen.add(record_key)
                cleaned_records.append(record)
        
        deduped_count = len(cleaned_records)
        logger.info(f"Deduplicated: {initial_count:,} → {deduped_count:,} (-{initial_count - deduped_count:,})")
        
        # Clean null values
        for record in cleaned_records:
            for key, value in record.items():
                if pd.isna(value) or value is None or value == "nan":
                    record[key] = None
        
        logger.info(f"✅ {deduped_count:,} {self.sources[source_key]['name']} records ready for import")
        return cleaned_records
    
    def parse_un_sanctions(self, xml_content: str) -> List[Dict[str, Any]]:
        """Parse UN sanctions XML into optimized format with memory management"""
        logger.info("📋 Parsing UN sanctions data...")
        
        try:
            # Use iterparse for memory efficiency
            context = ET.iterparse(io.StringIO(xml_content), events=('end',))
            sanctions = []
            processed = 0
            
            for event, elem in context:
                if elem.tag.endswith('INDIVIDUAL'):
                    # Name parsing
                    first_name = elem.find(".//{*}FIRST_NAME")
                    second_name = elem.find(".//{*}SECOND_NAME")
                    third_name = elem.find(".//{*}THIRD_NAME")
                    fourth_name = elem.find(".//{*}FOURTH_NAME")
                    
                    name_parts = []
                    for elem_name in [first_name, second_name, third_name, fourth_name]:
                        if elem_name is not None and elem_name.text:
                            name_parts.append(elem_name.text.strip())
                    
                    if not name_parts:
                        elem.clear()
                        continue
                    
                    full_name = " ".join(name_parts)
                    
                    # Extract aliases
                    aliases = []
                    for alias in elem.findall(".//{*}INDIVIDUAL_ALIAS"):
                        alias_name_elem = alias.find(".//{*}ALIAS_NAME")
                        if alias_name_elem is not None and alias_name_elem.text:
                            aliases.append(alias_name_elem.text.strip())
                    
                    # Extract nationalities
                    nationalities = []
                    for nat in elem.findall(".//{*}NATIONALITY"):
                        if nat is not None and nat.text:
                            nationalities.append(nat.text.strip())
                    
                    # Extract other details
                    un_list_type = elem.find(".//{*}UN_LIST_TYPE")
                    ref_number = elem.find(".//{*}REFERENCE_NUMBER")
                    dob_elem = elem.find(".//{*}DATE_OF_BIRTH")
                    
                    sanction = {
                        "entity_name": full_name,
                        "first_name": name_parts[0] if name_parts else None,
                        "last_name": name_parts[-1] if len(name_parts) > 1 else None,
                        "middle_name": " ".join(name_parts[1:-1]) if len(name_parts) > 2 else None,
                        "entity_type": "individual",
                        "list_source": "UN",
                        "program": un_list_type.text if un_list_type is not None and un_list_type.text else "UN Consolidated List",
                        "reference_number": ref_number.text if ref_number is not None and ref_number.text else "",
                        "date_of_birth_text": dob_elem.text if dob_elem is not None and dob_elem.text else None,
                        "nationalities": nationalities[:3],
                        "aliases": aliases[:10],
                        "is_pep": False,
                        "created_at": datetime.now().isoformat(),
                        "last_updated_date": datetime.now().isoformat()
                    }
                    sanctions.append(sanction)
                    processed += 1
                    
                    # Clear element to free memory
                    elem.clear()
                    while elem.getprevious() is not None:
                        del elem.getparent()[0]
                    
                    # Memory check every 1000 records
                    if processed % 1000 == 0:
                        self.check_memory_usage()
            
            logger.info(f"   ✓ Parsed {processed:,} UN sanctions entries")
            return sanctions
            
        except Exception as e:
            logger.error(f"   ✗ Error parsing UN sanctions: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def parse_ofac_sanctions(self, sdn_content: str, alt_content: str, add_content: str) -> List[Dict[str, Any]]:
        """Parse OFAC SDN files into optimized format with memory management"""
        logger.info("📋 Parsing OFAC sanctions data...")
        
        try:
            # Parse aliases CSV into memory-efficient dictionary
            logger.info("   Loading aliases...")
            aliases_map = {}
            alt_data = [line for line in alt_content.splitlines() if line.strip()]
            
            for i, line in enumerate(alt_data[1:], 1):  # Skip header
                row = next(csv.reader([line]))
                if len(row) < 4:
                    continue
                
                ent_num = row[0].strip()
                alt_name = row[3].strip()
                if ent_num and alt_name and alt_name != '-0-':
                    if ent_num not in aliases_map:
                        aliases_map[ent_num] = []
                    if len(aliases_map[ent_num]) < 10:  # Limit to 10 aliases
                        aliases_map[ent_num].append(alt_name)
            
            # Parse addresses/nationalities
            logger.info("   Loading nationalities...")
            nationality_map = {}
            add_data = [line for line in add_content.splitlines() if line.strip()]
            
            for i, line in enumerate(add_data[1:], 1):  # Skip header
                row = next(csv.reader([line]))
                if len(row) < 5:
                    continue
                
                ent_num = row[0].strip()
                country = row[4].strip()
                
                if ent_num and country and country != '-0-':
                    if ent_num not in nationality_map:
                        nationality_map[ent_num] = set()
                    if len(nationality_map[ent_num]) < 3:  # Limit to 3 nationalities
                        nationality_map[ent_num].add(country)
            
            # Parse main SDN file
            logger.info("   Parsing main SDN list...")
            sanctions = []
            sdn_data = [line for line in sdn_content.splitlines() if line.strip()]
            
            for i, line in enumerate(sdn_data[1:], 1):  # Skip header
                row = next(csv.reader([line]))
                if len(row) < 12:
                    continue
                
                ent_num = row[0].strip()
                full_name = row[1].strip()
                sdn_type = row[2].strip().lower()
                program = row[3].strip()
                remarks = row[11].strip() if len(row) > 11 else ''
                
                # Parse name: "LASTNAME, Firstname Middle"
                first_name, middle_name, last_name = None, None, None
                if ',' in full_name:
                    parts = full_name.split(',', 1)
                    last_name = parts[0].strip()
                    rest = parts[1].strip() if len(parts) > 1 else ''
                    name_parts = rest.split()
                    first_name = name_parts[0] if name_parts else None
                    middle_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else None
                
                # Extract DOB from remarks
                dob = None
                if remarks and remarks != '-0-':
                    match = re.search(r'DOB\s+(\d{1,2}\s+\w+\s+\d{4})', remarks, re.IGNORECASE)
                    if match:
                        dob = match.group(1)
                
                sanction = {
                    "entity_id": ent_num,
                    "entity_name": full_name,
                    "first_name": first_name,
                    "middle_name": middle_name,
                    "last_name": last_name,
                    "entity_type": "individual" if sdn_type == "individual" else "entity",
                    "list_source": "OFAC",
                    "program": program if program and program != '-0-' else "SDN List",
                    "date_of_birth_text": dob,
                    "nationalities": list(nationality_map.get(ent_num, set()))[:3],
                    "aliases": aliases_map.get(ent_num, [])[:10],
                    "remarks": remarks if remarks and remarks != '-0-' else None,
                    "is_pep": False,
                    "created_at": datetime.now().isoformat(),
                    "last_updated_date": datetime.now().isoformat()
                }
                sanctions.append(sanction)
                
                # Memory check every 1000 records
                if i % 1000 == 0:
                    self.check_memory_usage()
            
            logger.info(f"   ✓ Parsed {len(sanctions):,} OFAC sanctions entries")
            return sanctions
            
        except Exception as e:
            logger.error(f"   ✗ Error parsing OFAC sanctions: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def fetch_pep_data(self, json_content: str) -> List[Dict[str, Any]]:
        """
        Fetch PEP data from OpenSanctions, filtered by target countries.
        """
        logger.info("🎩 Fetching PEP data from OpenSanctions...")
        logger.info(f"   Target regions: MENA countries")
        
        try:
            peps = []
            total_processed = 0
            filtered_count = 0
            target_countries = self.sources['pep']['target_countries']
            
            # Process line by line to avoid memory issues
            for line in json_content.splitlines():
                if not line.strip():
                    continue
                
                total_processed += 1
                if total_processed % 50000 == 0:
                    logger.info(f"      Processed {total_processed:,} records, kept {filtered_count:,}...")
                    self.check_memory_usage()
                
                try:
                    data = json.loads(line)
                    properties = data.get('properties', {})
                    
                    # Get name
                    names = properties.get('name', [])
                    if not names or not names[0]:
                        continue
                    
                    # Get countries
                    countries = properties.get('country', [])
                    
                    # Filter by target countries
                    is_target_country = False
                    if countries:
                        country_str = ' '.join(str(c).upper() for c in countries)
                        if any(target in country_str for target in target_countries):
                            is_target_country = True
                    
                    if not is_target_country:
                        continue
                    
                    filtered_count += 1
                    
                    # Get nationalities (limit to 3)
                    nationalities = countries[:3] if countries else []
                    
                    pep = {
                        "entity_name": names[0],
                        "entity_type": "individual",
                        "list_source": "OpenSanctions-PEP",
                        "program": "Politically Exposed Person",
                        "is_pep": True,
                        "pep_level": "direct",
                        "position": ', '.join(properties.get('position', [])[:3]),
                        "jurisdiction": countries[0] if countries else '',
                        "nationalities": nationalities,
                        "aliases": properties.get('alias', [])[:10],
                        "date_of_birth_text": properties.get('birthDate', [None])[0],
                        "created_at": datetime.now().isoformat(),
                        "last_updated_date": datetime.now().isoformat()
                    }
                    peps.append(pep)
                    
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    continue
            
            logger.info(f"   ✓ Filtered {filtered_count:,} PEP entries from {total_processed:,} total records")
            return peps
            
        except Exception as e:
            logger.error(f"   ✗ Error fetching PEP data: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def import_to_supabase_batch(self, records: List[Dict[str, Any]], source_key: str):
        """🚀 Import data to Supabase in batches with memory management"""
        logger.info(f"\n🚀 IMPORTING {self.sources[source_key]['name']} TO SUPABASE...")
        
        try:
            # Clear existing data for this source
            logger.info(f"🗑️  Clearing existing {self.sources[source_key]['name']} data from database...")
            try:
                # Get count first
                response = self.supabase.table('sanctions_list')\
                    .select('id', count='exact')\
                    .eq('list_source', self.sources[source_key]['name'])\
                    .execute()
                
                existing_count = response.count
                
                if existing_count > 0:
                    # Delete in batches of 1000
                    batch_size = 1000
                    deleted = 0
                    
                    while deleted < existing_count:
                        batch_response = self.supabase.table('sanctions_list')\
                            .delete()\
                            .eq('list_source', self.sources[source_key]['name'])\
                            .limit(batch_size)\
                            .execute()
                        
                        batch_deleted = len(batch_response.data)
                        deleted += batch_deleted
                        logger.info(f"   ✓ Deleted batch: {batch_deleted:,} records (total: {deleted:,})")
                        
                        if batch_deleted == 0:  # No more records to delete
                            break
                
                logger.info(f"✅ Cleared {existing_count:,} existing records")
            except Exception as e:
                logger.warning(f"⚠️ Could not clear {self.sources[source_key]['name']} data: {e}")
            
            # Import in batches
            total = len(records)
            imported = 0
            failed = 0
            batch_num = 1
            
            logger.info(f"📦 Importing {total:,} {self.sources[source_key]['name']} records in batches of {self.BATCH_SIZE:,}...")
            
            with tqdm(total=total, desc=f"Importing {source_key}", unit="records") as pbar:
                for i in range(0, total, self.BATCH_SIZE):
                    batch = records[i:i + self.BATCH_SIZE]
                    
                    try:
                        # Insert batch
                        response = self.supabase.table('sanctions_list').insert(batch).execute()
                        
                        imported += len(batch)
                        pbar.update(len(batch))
                        pbar.set_description(f"✅ Imported {imported:,}/{total:,}")
                        
                        if imported % 50000 == 0:
                            logger.info(f"💾 Progress: {imported:,}/{total:,} ({imported/total*100:.1f}%)")
                            self.check_memory_usage()
                        
                        batch_num += 1
                        
                    except Exception as e:
                        failed += len(batch)
                        logger.error(f"❌ Batch {batch_num} failed: {e}")
                        # Continue with next batch instead of stopping
                        continue
            
            logger.info(f"\n✅ {self.sources[source_key]['name']} import complete!")
            logger.info(f"   ✓ Imported: {imported:,}")
            logger.info(f"   ✗ Failed: {failed:,}")
            logger.info(f"   📊 Success Rate: {(imported/total*100):.1f}%")
            
            return imported, failed
            
        except Exception as e:
            logger.error(f"❌ Critical import error for {source_key}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 0, len(records)
    
    def import_single_source(self, source_key: str, test_mode: bool = False):
        """Import a single source with proper memory management"""
        source_config = self.sources[source_key]
        logger.info(f"\n{'='*80}")
        logger.info(f"🔄 PROCESSING SOURCE: {source_config['name']}")
        logger.info(f"{'='*80}")
        
        try:
            records = []
            
            if source_config['type'] == DataSource.UN:
                logger.info("📥 Downloading UN sanctions data...")
                response = requests.get(source_config['url'], timeout=300)
                response.raise_for_status()
                records = self.parse_un_sanctions(response.text)
            
            elif source_config['type'] == DataSource.OFAC:
                logger.info("📥 Downloading OFAC sanctions data...")
                # Download all three OFAC files
                responses = {}
                for key, url in source_config['urls'].items():
                    response = requests.get(url, timeout=120)
                    response.raise_for_status()
                    responses[key] = response.text
                
                records = self.parse_ofac_sanctions(
                    responses['sdn'], 
                    responses['alt'], 
                    responses['add']
                )
            
            elif source_config['type'] == DataSource.PEP:
                logger.info("📥 Downloading PEP data...")
                response = requests.get(source_config['url'], stream=True, timeout=300)
                response.raise_for_status()
                
                # Process streaming response to avoid memory issues
                json_content = ""
                for chunk in response.iter_lines():
                    if chunk:
                        json_content += chunk.decode('utf-8') + "\n"
                
                records = self.fetch_pep_data(json_content)
            
            # Apply test mode limit if enabled
            if test_mode and len(records) > 10000:
                logger.info(f"   ⚠️ TEST MODE: Limiting to 10,000 records")
                records = records[:10000]
            
            if not records:
                logger.warning(f"⚠️ No records were processed for {source_config['name']}")
                return 0, 0
            
            # Clean data
            cleaned_records = self.clean_data(records, source_key)
            
            # Import to Supabase
            imported, failed = self.import_to_supabase_batch(cleaned_records, source_key)
            
            # Clear memory
            del records
            del cleaned_records
            gc.collect()
            self.check_memory_usage()
            
            return imported, failed
            
        except Exception as e:
            logger.error(f"❌ Failed to process {source_config['name']}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 0, 0
    
    def run_full_pipeline(self, test_mode: bool = False):
        """🎯 Run complete pipeline with batch processing and memory management"""
        self.start_time = datetime.now()
        total_imported = 0
        total_failed = 0
        
        logger.info("🚀 STARTING FULL SANCTIONS IMPORT PIPELINE")
        logger.info(f"⏱️  Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"🎲 Test Mode: {'ENABLED' if test_mode else 'DISABLED'}")
        
        try:
            # Process each source separately to manage memory
            for source_key in ['un', 'ofac', 'pep']:
                imported, failed = self.import_single_source(source_key, test_mode=test_mode)
                total_imported += imported
                total_failed += failed
            
            end_time = datetime.now()
            duration = (end_time - self.start_time).total_seconds() / 60
            
            logger.info("\n✨ PIPELINE COMPLETE!")
            logger.info(f"⏱️  Duration: {duration:.1f} minutes")
            logger.info(f"✅ Total Successfully Imported: {total_imported:,}")
            logger.info(f"❌ Total Failed: {total_failed:,}")
            logger.info("🎉 Database ready for use!")
            
            return total_imported, total_failed
            
        except KeyboardInterrupt:
            logger.info("\n⚠️  Import cancelled by user")
            sys.exit(1)
        except Exception as e:
            logger.error(f"\n💥 Fatal error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            sys.exit(1)


if __name__ == "__main__":
    try:
        # Set test mode to False for full import, True for testing
        TEST_MODE = False
        
        importer = SanctionsImporter()
        total_imported, total_failed = importer.run_full_pipeline(test_mode=TEST_MODE)
        
        if TEST_MODE:
            logger.info("\n🎯 TEST MODE COMPLETED SUCCESSFULLY!")
            logger.info("✅ Ready for full import. Set TEST_MODE = False to run full import.")
        
    except Exception as e:
        logger.error(f"\n💥 Fatal error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)