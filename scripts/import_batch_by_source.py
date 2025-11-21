#!/usr/bin/env python3
"""
Production batch import script - run each source separately
Use this after testing with the main import script to avoid memory issues
"""

import sys
import os
from dotenv import load_dotenv
import argparse
import time

# Load environment variables
load_dotenv('/workspaces/complianceai-pro/.env')

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.import_all_sanctions import SanctionsImporter, logger

def import_single_source(source_name, test_mode=False):
    """Import a single source with proper memory management"""
    try:
        importer = SanctionsImporter()
        
        # Filter sources to only the requested one
        if source_name not in importer.sources:
            logger.error(f"❌ Source '{source_name}' not found. Available sources: {list(importer.sources.keys())}")
            return False
        
        # Keep only the requested source
        importer.sources = {source_name: importer.sources[source_name]}
        
        logger.info(f"\n{'='*80}")
        logger.info(f"🚀 IMPORTING SINGLE SOURCE: {source_name}")
        logger.info(f"{'='*80}")
        
        # Run the pipeline for this source only
        total_imported, total_failed = importer.run_full_pipeline(test_mode=test_mode)
        
        logger.info(f"\n✅ SUCCESSFULLY IMPORTED SOURCE: {source_name}")
        logger.info(f"✅ Total Successfully Imported: {total_imported:,}")
        logger.info(f"❌ Total Failed: {total_failed:,}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to import source {source_name}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def main():
    parser = argparse.ArgumentParser(description='Import sanctions data by source')
    parser.add_argument('--source', required=True, help='Source to import (un, ofac, pep)')
    parser.add_argument('--test', action='store_true', help='Run in test mode (limited records)')
    parser.add_argument('--all', action='store_true', help='Import all sources sequentially')
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    if args.all:
        # Import all sources sequentially
        sources = ['un', 'ofac', 'pep']
        success_count = 0
        
        for source in sources:
            logger.info(f"\n{'='*80}")
            logger.info(f"🚀 IMPORTING SOURCE: {source}")
            logger.info(f"{'='*80}")
            
            success = import_single_source(source, test_mode=args.test)
            if success:
                success_count += 1
            
            # Wait between sources to allow memory cleanup
            logger.info("⏳ Waiting 30 seconds between sources for memory cleanup...")
            time.sleep(30)
        
        logger.info(f"\n{'='*80}")
        logger.info(f"🎉 BATCH IMPORT COMPLETE!")
        logger.info(f"✅ Successful sources: {success_count}/{len(sources)}")
        logger.info(f"⏱️  Total time: {time.time()-start_time:.1f} seconds")
        logger.info(f"{'='*80}")
        
    else:
        # Import single source
        success = import_single_source(args.source, test_mode=args.test)
        
        if success:
            logger.info(f"\n🎉 IMPORT COMPLETED SUCCESSFULLY!")
            logger.info(f"⏱️  Time taken: {time.time()-start_time:.1f} seconds")
        else:
            logger.error("\n❌ IMPORT FAILED!")
            sys.exit(1)

if __name__ == "__main__":
    main()