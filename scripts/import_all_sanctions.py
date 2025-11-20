import sys
import os
from dotenv import load_dotenv

# Load environment variables from root .env file
load_dotenv('/workspaces/complianceai-pro/.env')  # Explicit path to root .env

# Test if variables are loaded
print(f"🔍 SUPABASE_URL loaded: {'YES' if os.getenv('SUPABASE_URL') else 'NO'}")
print(f"🔍 SUPABASE_SERVICE_KEY loaded: {'YES' if os.getenv('SUPABASE_SERVICE_KEY') else 'NO'}")

import warnings
import logging
from datetime import datetime
import uuid
from typing import List, Dict, Any
import io

# Fix Pandas warnings
import pandas as pd
import numpy as np
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=pd.errors.SettingWithCopyWarning)
pd.options.mode.chained_assignment = None

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import requests
import json
from tqdm import tqdm
import xml.etree.ElementTree as ET

# Import Supabase client
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


class SanctionsImporter:
    """🌍 Fixed Sanctions Data Importer for Supabase"""
    
    BATCH_SIZE = 1000  # Supabase batch insert limit
    
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
    
    def download_opensanctions(self, url: str, source_name: str, is_pep: bool):
        """📥 Download OpenSanctions JSON"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        try:
            response = requests.get(url, stream=True, timeout=300)
            response.raise_for_status()
            
            processed = 0
            for line in response.iter_lines():
                if line:
                    try:
                        entity = json.loads(line)
                        props = entity.get('properties', {})
                        
                        name = self.get_first(props.get('name'))
                        if not name:
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
                            'nationalities': json.dumps(props.get('nationality', [])),
                            'aliases': json.dumps(props.get('alias', [])),
                            'date_of_birth': self.get_first(props.get('birthDate')),
                            'remarks': self.get_first(props.get('notes')),
                            'last_updated_date': datetime.now().isoformat(),
                            'created_at': datetime.now().isoformat()
                        }
                        
                        self.records.append(record)
                        processed += 1
                        
                        if processed % 25000 == 0:
                            logger.info(f"   ✓ {processed:,} records processed")
                    
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            logger.info(f"✅ {source_name}: {processed:,} records collected")
            
        except requests.RequestException as e:
            logger.error(f"❌ Network error {source_name}: {e}")
    
    def download_ofac(self, url: str, source_name: str):
        """📥 Download OFAC CSV"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            
            df = pd.read_csv(
                io.StringIO(response.text),
                encoding='latin1',
                on_bad_lines='skip',
                low_memory=False
            )
            
            for _, row in df.iterrows():
                record = {
                    'id': str(uuid.uuid4()),
                    'entity_name': str(row.iloc[1]) if len(row) > 1 else 'Unknown',
                    'entity_type': str(row.iloc[2]).lower() if len(row) > 2 else 'individual',
                    'first_name': None,
                    'last_name': None,
                    'list_source': source_name,
                    'program': str(row.iloc[3]) if len(row) > 3 else 'SDN',
                    'is_pep': False,
                    'pep_level': None,
                    'position': str(row.iloc[4]) if len(row) > 4 else None,
                    'jurisdiction': None,
                    'nationalities': None,
                    'aliases': None,
                    'date_of_birth': None,
                    'remarks': str(row.iloc[-1]) if len(row) > 5 else None,
                    'last_updated_date': datetime.now().isoformat(),
                    'created_at': datetime.now().isoformat()
                }
                self.records.append(record)
            
            logger.info(f"✅ {source_name}: {len(df):,} records collected")
            
        except Exception as e:
            logger.error(f"❌ OFAC error: {e}")
    
    def download_un(self, url: str, source_name: str):
        """📥 Download UN XML"""
        logger.info(f"📥 {source_name}")
        logger.info(f"🔗 {url}")
        
        try:
            response = requests.get(url, timeout=180)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            individuals = root.findall(".//INDIVIDUAL")
            
            for individual in individuals:
                first_name = individual.find(".//FIRST_NAME")
                last_name = individual.find(".//SECOND_NAME")
                
                name_parts = []
                if first_name is not None and first_name.text:
                    name_parts.append(first_name.text)
                if last_name is not None and last_name.text:
                    name_parts.append(last_name.text)
                
                if not name_parts:
                    continue
                
                record = {
                    'id': str(uuid.uuid4()),
                    'entity_name': " ".join(name_parts),
                    'entity_type': 'individual',
                    'first_name': first_name.text if first_name is not None else None,
                    'last_name': last_name.text if last_name is not None else None,
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
            
            logger.info(f"✅ {source_name}: {len(individuals):,} records collected")
            
        except Exception as e:
            logger.error(f"❌ UN error: {e}")
    
    def download_all_sources(self):
        """Download all sources"""
        logger.info("=" * 80)
        logger.info("🌍 DOWNLOADING ALL SOURCES")
        logger.info("=" * 80)
        
        for source_key, config in self.sources.items():
            if config['type'] == 'opensanctions':
                self.download_opensanctions(config['url'], config['name'], config['is_pep'])
            elif config['type'] == 'ofac':
                self.download_ofac(config['url'], config['name'])
            elif config['type'] == 'un':
                self.download_un(config['url'], config['name'])
        
        logger.info(f"📊 TOTAL: {len(self.records):,} records collected from all sources")
    
    def clean_data(self):
        """🧹 Clean & deduplicate"""
        logger.info("\n🧹 CLEANING AND VALIDATING DATA...")
        
        df = pd.DataFrame(self.records)
        
        # Deduplicate
        initial = len(df)
        df = df.drop_duplicates(subset=['entity_name', 'list_source'], keep='first')
        logger.info(f"Deduplicated: {initial:,} → {len(df):,} (-{initial-len(df):,})")
        
        # Clean nulls
        df = df.replace({np.nan: None, pd.NaT: None})
        
        self.records = df.to_dict('records')
        logger.info(f"✅ Cleaned: {len(self.records):,} records ready for import")
    
    def import_to_supabase(self):
        """🚀 Import to Supabase using correct table name"""
        logger.info("\n🚀 IMPORTING TO SUPABASE...")
        
        try:
            # Clear existing data from sanctions_list table (FIXED TABLE NAME)
            logger.info("🗑️  Clearing existing data from 'sanctions_list' table...")
            try:
                self.supabase.table('sanctions_list').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
                logger.info("✅ Table cleared successfully")
            except Exception as e:
                logger.warning(f"⚠️  Could not clear table (may be empty): {e}")
            
            # Import in batches
            total = len(self.records)
            imported = 0
            failed = 0
            
            logger.info(f"📦 Importing {total:,} records in batches of {self.BATCH_SIZE}...")
            
            with tqdm(total=total, desc="Importing", unit="rows") as pbar:
                for i in range(0, total, self.BATCH_SIZE):
                    batch = self.records[i:i + self.BATCH_SIZE]
                    
                    try:
                        # Insert batch into sanctions_list table (FIXED TABLE NAME)
                        response = self.supabase.table('sanctions_list').insert(batch).execute()
                        
                        imported += len(batch)
                        pbar.update(len(batch))
                        
                        # Log progress every 50k records
                        if imported % 50000 == 0:
                            logger.info(f"💾 Progress: {imported:,}/{total:,} ({imported/total*100:.1f}%)")
                    
                    except Exception as e:
                        failed += len(batch)
                        logger.error(f"❌ Batch {i//self.BATCH_SIZE + 1} failed: {e}")
                        continue
            
            self.total_imported = imported
            logger.info(f"\n✅ Import complete!")
            logger.info(f"   ✓ Imported: {imported:,}")
            logger.info(f"   ✗ Failed: {failed:,}")
            logger.info(f"   📊 Success Rate: {(imported/total*100):.1f}%")
            
            # Show statistics
            self._show_stats()
            
        except Exception as e:
            logger.error(f"❌ A critical error occurred during import: {e}")
            raise
    
    def _show_stats(self):
        """📊 Show final statistics"""
        try:
            # Get total count from sanctions_list table (FIXED TABLE NAME)
            result = self.supabase.table('sanctions_list').select('id', count='exact').limit(1).execute()
            final_count = result.count
            
            logger.info(f"\n📊 Final Statistics:")
            logger.info(f"   • Total records in DB: {final_count:,}")
            
            # Get count by source
            sources_result = self.supabase.table('sanctions_list').select('list_source').execute()
            if sources_result.data:
                from collections import Counter
                source_counts = Counter(row['list_source'] for row in sources_result.data)
                
                logger.info(f"\n📋 Records by source:")
                for source, count in source_counts.most_common():
                    logger.info(f"   • {source:<30} {count:>6,}")
        
        except Exception as e:
            logger.error(f"❌ Could not retrieve statistics: {e}")
    
    def run_full_pipeline(self):
        """🎯 Run complete pipeline"""
        start = datetime.now()
        
        logger.info("🚀 STARTING FULL SANCTIONS IMPORT PIPELINE")
        logger.info(f"⏱️  Started: {start.strftime('%Y-%m-%d %H:%M:%S')}")
        
        self.download_all_sources()
        self.clean_data()
        self.import_to_supabase()  # FIXED METHOD NAME
        
        end = datetime.now()
        duration = (end - start).total_seconds() / 60
        
        logger.info("\n✨ PIPELINE COMPLETE!")
        logger.info(f"⏱️  Duration: {duration:.1f} minutes")
        logger.info("🎉 Database ready for use!")


if __name__ == "__main__":
    try:
        importer = SanctionsImporter()
        importer.run_full_pipeline()
    except KeyboardInterrupt:
        logger.info("\n⚠️  Import cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n💥 Fatal error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)