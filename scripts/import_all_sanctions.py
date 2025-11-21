import sys
import os
from dotenv import load_dotenv
import warnings
import logging
from datetime import datetime
import uuid
from typing import List, Dict, Any, Optional
import io
import gc
import psutil
import json

# Load environment variables first
load_dotenv('/workspaces/complianceai-pro/.env')

# Test if variables are loaded
print(f"🔍 SUPABASE_URL loaded: {'YES' if os.getenv('SUPABASE_URL') else 'NO'}")
print(f"🔍 SUPABASE_SERVICE_KEY loaded: {'YES' if os.getenv('SUPABASE_SERVICE_KEY') else 'NO'}")

# Fix Pandas warnings
import pandas as pd
import numpy as np
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=pd.errors.SettingWithCopyWarning)
pd.options.mode.chained_assignment = None

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import requests
from tqdm import tqdm
import xml.etree.ElementTree as ET
from supabase import create_client, Client

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

def check_memory_usage():
    """Monitor memory usage and trigger garbage collection if needed"""
    try:
        memory_percent = psutil.virtual_memory().percent
        if memory_percent > 80:
            logger.warning(f"⚠️  High memory usage: {memory_percent}% - forcing garbage collection")
            gc.collect()
            mem = psutil.virtual_memory()
            logger.info(f"💾 Memory after GC: {mem.percent}% used, {mem.available / 1024**3:.2f}GB available")
    except Exception as e:
        logger.error(f"Error checking memory usage: {e}")

class SanctionsImporter:
    """🌍 Memory-Optimized Sanctions Data Importer for Supabase with MENA PEP Filter"""
    
    BATCH_SIZE = 1000
    DOWNLOAD_BATCH_SIZE = 50000
    MAX_MEMORY_PERCENT = 85
    
    # MENA nationality filter - EXPANDED with more variations
    MENA_NATIONALITIES = {
        # Normalize everything to lowercase for matching
        'dz', 'dza', 'algeria', 'algerian',
        'bh', 'bhr', 'bahrain', 'bahraini',
        'dj', 'dji', 'djibouti', 'djiboutian',
        'eg', 'egy', 'egypt', 'egyptian',
        'ir', 'irn', 'iran', 'iranian',
        'iq', 'irq', 'iraq', 'iraqi',
        'il', 'isr', 'israel', 'israeli',
        'jo', 'jor', 'jordan', 'jordanian',
        'kw', 'kwt', 'kuwait', 'kuwaiti',
        'lb', 'lbn', 'lebanon', 'lebanese',
        'ly', 'lby', 'libya', 'libyan',
        'mt', 'mlt', 'malta', 'maltese',
        'ma', 'mar', 'morocco', 'moroccan',
        'om', 'omn', 'oman', 'omani',
        'ps', 'pse', 'palestine', 'palestinian',
        'qa', 'qat', 'qatar', 'qatari',
        'sa', 'sau', 'saudi arabia', 'saudi', 'saudi arabian',
        'so', 'som', 'somalia', 'somalian',
        'sd', 'sdn', 'sudan', 'sudanese',
        'sy', 'syr', 'syria', 'syrian',
        'tn', 'tun', 'tunisia', 'tunisian',
        'ae', 'are', 'united arab emirates', 'uae', 'emirati',
        'ye', 'yem', 'yemen', 'yemeni'
    }
    
    def __init__(self):
        self.records: List[Dict[str, Any]] = []
        self.total_imported = 0
        
        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        logger.info("✅ Supabase client initialized")
        
        self.sources = {
            'opensanctions_peps': {
                'name': 'OpenSanctions PEPs',
                'url': 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json',
                'is_pep': True,
                'type': 'opensanctions'
            },
            'opensanctions_sanctions': {
                'name': 'OpenSanctions Global Sanctions',
                'url': 'https://data.opensanctions.org/datasets/latest/sanctions/entities.ftm.json',
                'is_pep': False,
                'type': 'opensanctions'
            },
            'opensanctions_uae': {
                'name': 'UAE Local Terrorist List',
                'url': 'https://data.opensanctions.org/datasets/latest/ae_local_terrorists/entities.ftm.json',
                'is_pep': False,
                'type': 'opensanctions'
            },
            'opensanctions_uk': {
                'name': 'UK HMT/OFSI Sanctions',
                'url': 'https://data.opensanctions.org/datasets/latest/gb_hmt_sanctions/entities.ftm.json',
                'is_pep': False,
                'type': 'opensanctions'
            },
            'ofac': {
                'name': 'OFAC SDN List',
                'url': 'https://www.treasury.gov/ofac/downloads/sdn.csv',
                'is_pep': False,
                'type': 'ofac'
            },
            'un': {
                'name': 'UN Consolidated List',
                'url': 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
                'is_pep': False,
                'type': 'un'
            }
        }
    
    def get_first(self, val: Any) -> Any:
        """Get first element if list, otherwise return value"""
        if isinstance(val, list) and val:
            return val[0]
        return val
    
    def has_mena_nationality(self, nationalities: list) -> bool:
        """Check if any nationality matches MENA region - case insensitive"""
        if not nationalities:
            return False
        
        for nat in nationalities:
            if nat:
                # Normalize to lowercase and strip whitespace
                nat_normalized = str(nat).lower().strip()
                if nat_normalized in self.MENA_NATIONALITIES:
                    return True
        return False
    
    def download_opensanctions_batch(self, url: str, source_name: str, is_pep: bool, limit: Optional[int] = None):
        """📥 Download OpenSanctions JSON with improved MENA PEP filtering"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        if is_pep:
            logger.info("🔍 Applying MENA nationality filter for PEPs")
        
        try:
            response = requests.get(url, stream=True, timeout=300)
            response.raise_for_status()
            
            processed = 0
            filtered_out = 0
            current_batch = []
            
            for line in response.iter_lines():
                if line:
                    try:
                        entity = json.loads(line)
                        props = entity.get('properties', {})
                        
                        name = self.get_first(props.get('name'))
                        if not name:
                            continue
                        
                        # **FILTER PEPs BY MENA NATIONALITY**
                        if is_pep:
                            nationalities = props.get('nationality', [])
                            if not self.has_mena_nationality(nationalities):
                                filtered_out += 1
                                continue
                        
                        program = 'PEP' if is_pep else self.get_first(props.get('program')) or 'Sanctions'
                        
                        record = {
                            'id': str(uuid.uuid4()),
                            'entity_name': str(name),
                            'entity_type': entity.get('schema', 'Person').lower(),
                            'first_name': self.get_first(props.get('firstName')),
                            'last_name': self.get_first(props.get('lastName')),
                            'list_source': source_name,
                            'program': program,
                            'is_pep': is_pep,
                            'pep_level': self.get_first(props.get('pepStatus')),
                            'position': self.get_first(props.get('position')),
                            'jurisdiction': self.get_first(props.get('country')),
                            'nationalities': json.dumps(props.get('nationality', [])) if props.get('nationality') else None,
                            'aliases': json.dumps(props.get('alias', [])) if props.get('alias') else None,
                            'date_of_birth': self.get_first(props.get('birthDate')),
                            'remarks': self.get_first(props.get('notes')),
                            'last_updated_date': datetime.now().isoformat(),
                            'created_at': datetime.now().isoformat()
                        }
                        
                        current_batch.append(record)
                        processed += 1
                        
                        if len(current_batch) >= self.DOWNLOAD_BATCH_SIZE:
                            self.records.extend(current_batch)
                            logger.info(f"   ✓ Batch processed: {processed:,} records")
                            current_batch = []
                            check_memory_usage()
                        
                        if limit and processed >= limit:
                            logger.info(f"   ⚠️ LIMIT REACHED: Stopped after {limit:,} records")
                            break
                    
                    except (json.JSONDecodeError, KeyError) as e:
                        continue
            
            if current_batch:
                self.records.extend(current_batch)
            
            if is_pep:
                logger.info(f"✅ {source_name}: {processed:,} MENA PEPs collected ({filtered_out:,} non-MENA filtered)")
            else:
                logger.info(f"✅ {source_name}: {processed:,} records collected")
            
            return processed
            
        except Exception as e:
            logger.error(f"❌ Error {source_name}: {e}")
            return 0
    
    def download_ofac_batch(self, url: str, source_name: str, limit: Optional[int] = None):
        """📥 Download OFAC CSV"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            
            df_chunks = pd.read_csv(
                io.StringIO(response.text),
                encoding='latin1',
                on_bad_lines='skip',
                low_memory=False,
                chunksize=10000
            )
            
            processed = 0
            for chunk in df_chunks:
                for _, row in chunk.iterrows():
                    if limit and processed >= limit:
                        return processed
                    
                    record = {
                        'id': str(uuid.uuid4()),
                        'entity_name': str(row.iloc[1]) if len(row) > 1 and pd.notna(row.iloc[1]) else 'Unknown',
                        'entity_type': str(row.iloc[2]).lower() if len(row) > 2 and pd.notna(row.iloc[2]) else 'individual',
                        'first_name': None,
                        'last_name': None,
                        'list_source': source_name,
                        'program': str(row.iloc[3]) if len(row) > 3 and pd.notna(row.iloc[3]) else 'SDN',
                        'is_pep': False,
                        'pep_level': None,
                        'position': str(row.iloc[4]) if len(row) > 4 and pd.notna(row.iloc[4]) else None,
                        'jurisdiction': None,
                        'nationalities': None,
                        'aliases': None,
                        'date_of_birth': None,
                        'remarks': str(row.iloc[-1]) if len(row) > 5 and pd.notna(row.iloc[-1]) else None,
                        'last_updated_date': datetime.now().isoformat(),
                        'created_at': datetime.now().isoformat()
                    }
                    self.records.append(record)
                    processed += 1
                
                check_memory_usage()
            
            logger.info(f"✅ {source_name}: {processed:,} records collected")
            return processed
            
        except Exception as e:
            logger.error(f"❌ OFAC error: {e}")
            return 0
    
    def download_un_batch(self, url: str, source_name: str, limit: Optional[int] = None):
        """📥 Download UN XML - FIXED"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        try:
            response = requests.get(url, timeout=180)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            processed = 0
            
            for individual in root.findall('.//INDIVIDUAL'):
                if limit and processed >= limit:
                    break
                
                first_name = individual.find('.//FIRST_NAME')
                last_name = individual.find('.//SECOND_NAME')
                
                name_parts = []
                if first_name is not None and first_name.text:
                    name_parts.append(first_name.text.strip())
                if last_name is not None and last_name.text:
                    name_parts.append(last_name.text.strip())
                
                if not name_parts:
                    continue
                
                record = {
                    'id': str(uuid.uuid4()),
                    'entity_name': " ".join(name_parts),
                    'entity_type': 'individual',
                    'first_name': first_name.text.strip() if first_name is not None and first_name.text else None,
                    'last_name': last_name.text.strip() if last_name is not None and last_name.text else None,
                    'list_source': source_name,
                    'program': 'UN Sanctions',
                    'is_pep': False,
                    'pep_level': None,
                    'position': None,
                    'jurisdiction': None,
                    'nationalities': None,
                    'aliases': None,
                    'date_of_birth': None,
                    'remarks': None,
                    'last_updated_date': datetime.now().isoformat(),
                    'created_at': datetime.now().isoformat()
                }
                self.records.append(record)
                processed += 1
            
            logger.info(f"✅ {source_name}: {processed:,} records collected")
            return processed
            
        except Exception as e:
            logger.error(f"❌ UN error: {e}")
            return 0
    
    def download_all_sources_batch(self, test_mode=False):
        """Download all sources"""
        logger.info("=" * 80)
        logger.info("🌍 DOWNLOADING ALL SOURCES")
        logger.info("=" * 80)
        
        limit = 10000 if test_mode else None
        
        for source_key, config in self.sources.items():
            logger.info(f"\n🔄 Processing: {config['name']}")
            
            try:
                if config['type'] == 'opensanctions':
                    count = self.download_opensanctions_batch(config['url'], config['name'], config['is_pep'], limit)
                elif config['type'] == 'ofac':
                    count = self.download_ofac_batch(config['url'], config['name'], limit)
                elif config['type'] == 'un':
                    count = self.download_un_batch(config['url'], config['name'], limit)
                
                logger.info(f"📊 {config['name']}: {count:,} records added")
                check_memory_usage()
                
            except Exception as e:
                logger.error(f"❌ Failed {config['name']}: {e}")
                continue
        
        logger.info(f"\n📊 TOTAL: {len(self.records):,} records collected")
    
    def clean_data_batch(self):
        """🧹 Clean & deduplicate"""
        logger.info("\n🧹 CLEANING DATA...")
        
        if not self.records:
            logger.error("❌ No records to clean!")
            return
        
        try:
            df = pd.DataFrame(self.records)
            initial = len(df)
            df = df.drop_duplicates(subset=['entity_name', 'list_source'], keep='first')
            logger.info(f"Deduplicated: {initial:,} → {len(df):,} (-{initial-len(df):,})")
            
            df = df.replace({np.nan: None, pd.NaT: None})
            self.records = df.to_dict('records')
            
            logger.info(f"✅ Cleaned: {len(self.records):,} records ready")
            
        except Exception as e:
            logger.error(f"❌ Cleaning error: {e}")
            raise
    
    def clear_database(self):
        """🗑️ FIXED: Clear database properly"""
        logger.info("\n🗑️  CLEARING DATABASE...")
        
        try:
            total_deleted = 0
            
            # Method 1: Try to get count first
            try:
                result = self.supabase.table('sanctions_list').select('id', count='exact').limit(1).execute()
                total_count = result.count if result.count else 0
                logger.info(f"Found {total_count:,} existing records to delete")
            except:
                total_count = 0
            
            if total_count == 0:
                logger.info("✅ Table is already empty")
                return
            
            # Method 2: Delete in batches without limit() which isn't supported
            batch_num = 1
            max_batches = 200  # Safety limit
            
            while batch_num <= max_batches:
                try:
                    # Delete without using limit - just delete first 1000
                    result = self.supabase.table('sanctions_list')\
                        .delete()\
                        .neq('id', '00000000-0000-0000-0000-000000000000')\
                        .execute()
                    
                    deleted_count = len(result.data) if result.data else 0
                    
                    if deleted_count == 0:
                        break
                    
                    total_deleted += deleted_count
                    logger.info(f"   ✓ Batch {batch_num}: Deleted {deleted_count:,} (Total: {total_deleted:,})")
                    batch_num += 1
                    
                except Exception as e:
                    logger.warning(f"Delete batch {batch_num} error: {e}")
                    break
            
            logger.info(f"✅ Cleared {total_deleted:,} records")
            
        except Exception as e:
            logger.error(f"❌ Clear error: {e}")
            logger.info("Continuing with import anyway...")
    
    def import_to_supabase_batch(self):
        """🚀 Import to Supabase"""
        logger.info("\n🚀 IMPORTING TO SUPABASE...")
        
        try:
            total = len(self.records)
            imported = 0
            failed = 0
            
            logger.info(f"📦 Importing {total:,} records in batches of {self.BATCH_SIZE}...")
            
            with tqdm(total=total, desc="Importing", unit="rows") as pbar:
                for i in range(0, total, self.BATCH_SIZE):
                    batch = self.records[i:i + self.BATCH_SIZE]
                    
                    try:
                        self.supabase.table('sanctions_list').insert(batch).execute()
                        imported += len(batch)
                        pbar.update(len(batch))
                        
                        if imported % 50000 == 0:
                            logger.info(f"💾 Progress: {imported:,}/{total:,} ({imported/total*100:.1f}%)")
                            check_memory_usage()
                        
                    except Exception as e:
                        failed += len(batch)
                        logger.error(f"❌ Batch failed: {e}")
                        continue
            
            self.total_imported = imported
            logger.info(f"\n✅ Import complete!")
            logger.info(f"   ✓ Imported: {imported:,}")
            logger.info(f"   ✗ Failed: {failed:,}")
            logger.info(f"   📊 Success: {(imported/total*100):.1f}%")
            
            self._show_stats()
            
        except Exception as e:
            logger.error(f"❌ Import error: {e}")
            raise
    
    def _show_stats(self):
        """📊 Show statistics"""
        try:
            logger.info(f"\n📊 Final Statistics:")
            
            result = self.supabase.table('sanctions_list').select('id', count='exact').limit(1).execute()
            final_count = result.count
            logger.info(f"   • Total records in DB: {final_count:,}")
            
            logger.info(f"\n📋 Records by source:")
            from collections import Counter
            source_counts = Counter(record['list_source'] for record in self.records)
            for source, count in source_counts.most_common():
                logger.info(f"   • {source:<40} {count:>8,}")
            
            pep_count = sum(1 for record in self.records if record.get('is_pep'))
            logger.info(f"\n🎯 PEP Statistics:")
            logger.info(f"   • Total MENA PEPs: {pep_count:,}")
        
        except Exception as e:
            logger.error(f"❌ Stats error: {e}")
    
    def run_full_pipeline_batch(self, test_mode=False, clean_first=True):
        """🎯 Run complete pipeline"""
        start = datetime.now()
        
        logger.info("=" * 80)
        logger.info("🚀 SANCTIONS IMPORT PIPELINE")
        logger.info("=" * 80)
        logger.info(f"⏱️  Started: {start.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"🎲 Test Mode: {'ENABLED' if test_mode else 'DISABLED'}")
        logger.info(f"🧹 Clean First: {'YES' if clean_first else 'NO'}")
        
        try:
            if clean_first:
                self.clear_database()
            
            self.download_all_sources_batch(test_mode=test_mode)
            
            if not self.records:
                logger.error("❌ No records downloaded!")
                return
            
            self.clean_data_batch()
            self.import_to_supabase_batch()
            
            end = datetime.now()
            duration = (end - start).total_seconds() / 60
            
            logger.info("\n" + "=" * 80)
            logger.info("✨ COMPLETE!")
            logger.info("=" * 80)
            logger.info(f"⏱️  Duration: {duration:.1f} minutes")
            
        except KeyboardInterrupt:
            logger.info("\n⚠️  Cancelled")
            sys.exit(1)
        except Exception as e:
            logger.error(f"\n💥 Fatal error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            sys.exit(1)


if __name__ == "__main__":
    try:
        TEST_MODE = False
        CLEAN_DATABASE = True
        
        logger.info("=" * 80)
        logger.info("⚙️  CONFIGURATION")
        logger.info("=" * 80)
        logger.info(f"Test Mode: {TEST_MODE}")
        logger.info(f"Clean Database: {CLEAN_DATABASE}")
        logger.info(f"MENA PEP Filter: ENABLED")
        logger.info("=" * 80)
        
        importer = SanctionsImporter()
        importer.run_full_pipeline_batch(test_mode=TEST_MODE, clean_first=CLEAN_DATABASE)
        
    except Exception as e:
        logger.error(f"\n💥 Fatal: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)