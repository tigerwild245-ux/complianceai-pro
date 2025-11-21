#!/usr/bin/env python3
"""
MENA/Arab League PEP Filter & Processor
Downloads and filters PEPs from OpenSanctions for MENA region
"""

import pandas as pd
import csv
import sys
import os
from urllib.request import urlretrieve
from datetime import datetime

# Core Arab League countries (22 members)
ARAB_LEAGUE_CODES = {
    'DZ',  # Algeria
    'BH',  # Bahrain
    'KM',  # Comoros
    'DJ',  # Djibouti
    'EG',  # Egypt
    'IQ',  # Iraq
    'JO',  # Jordan
    'KW',  # Kuwait
    'LB',  # Lebanon
    'LY',  # Libya
    'MR',  # Mauritania
    'MA',  # Morocco
    'OM',  # Oman
    'PS',  # Palestine
    'QA',  # Qatar
    'SA',  # Saudi Arabia
    'SO',  # Somalia
    'SD',  # Sudan
    'SY',  # Syria
    'TN',  # Tunisia
    'AE',  # UAE
    'YE'   # Yemen
}

# MENA region includes Arab League + Iran and Turkey
MENA_CODES = ARAB_LEAGUE_CODES.union({'IR', 'TR'})

# OpenSanctions PEP data URL
DATA_URL = 'https://data.opensanctions.org/datasets/20251120/peps/targets.simple.csv'

def is_mena_or_arab(country_codes_str):
    """
    Checks if any of the country codes belong to MENA/Arab region.
    
    Args:
        country_codes_str: String containing country codes (can be semicolon or comma separated)
        
    Returns:
        bool: True if any code matches MENA region
    """
    if pd.isna(country_codes_str) or country_codes_str == '':
        return False
    
    # Clean and normalize the string
    cleaned_str = str(country_codes_str).replace('"', ' ').replace(';', ' ').replace(',', ' ')
    
    # Extract country codes
    codes = {code.strip().upper() for code in cleaned_str.split() if code.strip()}
    
    return bool(codes.intersection(MENA_CODES))

def get_primary_country(country_codes_str):
    """
    Extract the primary (first) MENA country code from the string.
    
    Args:
        country_codes_str: String containing country codes
        
    Returns:
        str: First MENA country code found, or 'Unknown'
    """
    if pd.isna(country_codes_str) or country_codes_str == '':
        return 'Unknown'
    
    cleaned_str = str(country_codes_str).replace('"', ' ').replace(';', ' ').replace(',', ' ')
    codes = [code.strip().upper() for code in cleaned_str.split() if code.strip()]
    
    # Return first MENA code found
    for code in codes:
        if code in MENA_CODES:
            return code
    
    return 'Unknown'

def download_file(url, filename):
    """Download file from URL with progress indication."""
    print(f"📥 Downloading from {url}...")
    try:
        urlretrieve(url, filename)
        file_size = os.path.getsize(filename) / (1024 * 1024)  # Size in MB
        print(f"✅ Downloaded: {filename} ({file_size:.2f} MB)")
        return True
    except Exception as e:
        print(f"❌ Download failed: {e}", file=sys.stderr)
        return False

def analyze_country_distribution(df, country_col='primary_country'):
    """Print country-wise distribution of PEPs."""
    print("\n📊 Country Distribution:")
    print("-" * 50)
    
    country_counts = df[country_col].value_counts()
    total = len(df)
    
    for country, count in country_counts.items():
        percentage = (count / total) * 100
        print(f"  {country}: {count:,} ({percentage:.1f}%)")
    
    print("-" * 50)
    print(f"  TOTAL: {total:,} PEPs\n")

def filter_and_process_peps(input_file, output_file):
    """
    Main processing function to filter MENA PEPs.
    
    Args:
        input_file: Path to input CSV
        output_file: Path to output CSV
    """
    print("\n🔄 Processing PEP data...")
    
    try:
        # Read CSV with robust settings
        print("📖 Reading CSV file...")
        df = pd.read_csv(
            input_file,
            dtype=str,
            engine='python',
            quoting=csv.QUOTE_MINIMAL,
            on_bad_lines='warn'  # Skip malformed lines with warning
        )
        
        print(f"✅ Loaded {len(df):,} total records")
        
        # Check if required columns exist
        required_cols = ['name', 'countries', 'schema']
        missing_cols = [col for col in required_cols if col not in df.columns]
        
        if missing_cols:
            print(f"❌ Missing columns: {missing_cols}")
            print(f"Available columns: {df.columns.tolist()}")
            return False
        
        # Filter for MENA/Arab countries
        print("\n🔍 Filtering for MENA/Arab region...")
        filtered_df = df[df['countries'].apply(is_mena_or_arab)].copy()
        print(f"✅ Found {len(filtered_df):,} MENA/Arab records")
        
        if len(filtered_df) == 0:
            print("⚠️  No MENA records found. Check country codes in data.")
            return False
        
        # Filter for Persons only (exclude organizations)
        print("\n👤 Filtering for Persons only...")
        filtered_df = filtered_df[filtered_df['schema'] == 'Person'].copy()
        print(f"✅ Retained {len(filtered_df):,} Person records")
        
        # Add primary country for sorting
        print("\n🏷️  Adding primary country labels...")
        filtered_df['primary_country'] = filtered_df['countries'].apply(get_primary_country)
        
        # Sort by country
        print("📑 Sorting by country...")
        sorted_df = filtered_df.sort_values(by='primary_country', ascending=True)
        
        # Analyze distribution
        analyze_country_distribution(sorted_df)
        
        # Select output columns
        output_columns = [
            'name',
            'countries',
            'primary_country',
            'schema',
            'dataset',
            'first_seen',
            'last_seen',
            'caption'
        ]
        
        # Only include columns that exist
        available_output_cols = [col for col in output_columns if col in sorted_df.columns]
        final_result = sorted_df[available_output_cols]
        
        # Remove duplicates based on name
        print("🔍 Removing duplicates...")
        initial_count = len(final_result)
        final_result = final_result.drop_duplicates(subset=['name'], keep='first')
        duplicates_removed = initial_count - len(final_result)
        print(f"✅ Removed {duplicates_removed:,} duplicate names")
        
        # Save to CSV
        print(f"\n💾 Saving to {output_file}...")
        final_result.to_csv(output_file, index=False, quoting=csv.QUOTE_MINIMAL)
        
        print(f"\n✅ SUCCESS!")
        print(f"📄 Output file: {output_file}")
        print(f"📊 Total unique PEPs: {len(final_result):,}")
        
        # Summary statistics
        print("\n" + "="*50)
        print("SUMMARY")
        print("="*50)
        print(f"Input records:        {len(df):,}")
        print(f"MENA records:         {len(filtered_df):,}")
        print(f"Persons only:         {len(sorted_df):,}")
        print(f"After deduplication:  {len(final_result):,}")
        print("="*50 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during processing: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main execution function."""
    print("\n" + "="*60)
    print("  MENA/Arab League PEP Filter & Processor")
    print("  OpenSanctions Data")
    print("="*60 + "\n")
    
    # File paths - save to data directory
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    input_file = os.path.join(data_dir, 'targets.simple.csv')
    output_file = os.path.join(data_dir, 'mena_arab_peps_sorted.csv')
    
    # Step 1: Download data (if not exists)
    if not os.path.exists(input_file):
        print("📥 Input file not found. Downloading...")
        if not download_file(DATA_URL, input_file):
            print("❌ Failed to download data. Exiting.")
            sys.exit(1)
    else:
        print(f"✅ Using existing file: {input_file}")
    
    # Step 2: Process and filter
    success = filter_and_process_peps(input_file, output_file)
    
    if success:
        print("\n🎉 Processing complete!")
        print(f"\nNext steps:")
        print(f"  1. Review the output: {output_file}")
        print(f"  2. Run the import script:")
        print(f"     cd server && node scripts/importMENAPEPs.js")
        sys.exit(0)
    else:
        print("\n❌ Processing failed.")
        sys.exit(1)

if __name__ == "__main__":
    # Check Python version
    if sys.version_info < (3, 6):
        print("❌ Python 3.6+ required", file=sys.stderr)
        sys.exit(1)
    
    # Check pandas installation
    try:
        import pandas as pd
    except ImportError:
        print("❌ pandas not installed. Run: pip install pandas", file=sys.stderr)
        sys.exit(1)
    
    main()
