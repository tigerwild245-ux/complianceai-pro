#!/usr/bin/env python3
"""
Download and Parse Script for Compliance AI Pro
Downloads latest sanctions lists (UN/OFAC) and filtered PEP data from OpenSanctions,
then saves optimized JSON files locally for API ingestion.
"""

import json
import os
import sys
import requests
import xml.etree.ElementTree as ET
import csv
import re
from datetime import datetime
from pathlib import Path

# Configuration
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data-import"
DATA_DIR.mkdir(exist_ok=True)

SANCTIONS_OUTPUT = DATA_DIR / "sanctions_optimized.json"
PEP_OUTPUT = DATA_DIR / "pep_optimized.json"

# Data source URLs
UN_SANCTIONS_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"
OFAC_ALT_URL = "https://www.treasury.gov/ofac/downloads/alt.csv"
OFAC_ADD_URL = "https://www.treasury.gov/ofac/downloads/add.csv"
OPENSANCTIONS_PEP_URL = "https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json"

# Target countries for PEP filtering (ISO codes and names)
TARGET_COUNTRIES = {
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

def download_file(url, filename, stream=False):
    """Download a file from URL with progress indication."""
    print(f"📥 Downloading {filename}...")
    try:
        response = requests.get(url, stream=stream, timeout=120)
        response.raise_for_status()
        
        if stream:
            return response
        
        filepath = DATA_DIR / filename
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"   ✓ Downloaded {filename} ({filepath.stat().st_size / 1024:.1f} KB)")
        return filepath
    except Exception as e:
        print(f"   ✗ Error downloading {filename}: {e}")
        return None

def parse_un_sanctions(xml_file):
    """Parse UN sanctions XML into optimized JSON format."""
    print("\n📋 Parsing UN sanctions data...")
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        sanctions = []
        for individual in root.findall(".//INDIVIDUAL"):
            # Name parsing
            first_name = individual.find(".//FIRST_NAME")
            second_name = individual.find(".//SECOND_NAME")
            third_name = individual.find(".//THIRD_NAME")
            fourth_name = individual.find(".//FOURTH_NAME")
            
            name_parts = []
            for elem in [first_name, second_name, third_name, fourth_name]:
                if elem is not None and elem.text:
                    name_parts.append(elem.text.strip())
            
            if not name_parts:
                continue
            
            full_name = " ".join(name_parts)
            
            # Extract aliases
            aliases = []
            for alias in individual.findall(".//INDIVIDUAL_ALIAS"):
                alias_name_elem = alias.find(".//ALIAS_NAME")
                if alias_name_elem is not None and alias_name_elem.text:
                    aliases.append(alias_name_elem.text.strip())
            
            # Extract nationalities
            nationalities = []
            for nat in individual.findall(".//NATIONALITY"):
                if nat.text:
                    nationalities.append(nat.text.strip())
            
            # Extract other details
            un_list_type = individual.find(".//UN_LIST_TYPE")
            ref_number = individual.find(".//REFERENCE_NUMBER")
            dob_elem = individual.find(".//DATE_OF_BIRTH")
            
            sanction = {
                "entity_name": full_name,
                "first_name": name_parts[0] if name_parts else None,
                "last_name": name_parts[-1] if len(name_parts) > 1 else None,
                "middle_name": " ".join(name_parts[1:-1]) if len(name_parts) > 2 else None,
                "entity_type": "individual",
                "list_source": "UN",
                "program": un_list_type.text if un_list_type is not None else "UN Consolidated List",
                "reference_number": ref_number.text if ref_number is not None else "",
                "date_of_birth_text": dob_elem.text if dob_elem is not None else None,
                "nationalities": nationalities[:3],
                "aliases": aliases[:10],
                "is_pep": False
            }
            sanctions.append(sanction)
        
        print(f"   ✓ Parsed {len(sanctions)} UN sanctions entries")
        return sanctions
    except Exception as e:
        print(f"   ✗ Error parsing UN sanctions: {e}")
        import traceback
        traceback.print_exc()
        return []

def parse_ofac_sanctions(sdn_file, alt_file, add_file):
    """Parse OFAC SDN CSV files into optimized JSON format."""
    print("\n📋 Parsing OFAC sanctions data...")
    try:
        # Read aliases
        print("   Loading aliases...")
        aliases_map = {}
        with open(alt_file, 'r', encoding='latin-1') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 4:
                    continue
                ent_num = row[0].strip()
                alt_name = row[3].strip()
                if ent_num and alt_name and alt_name != '-0-':
                    if ent_num not in aliases_map:
                        aliases_map[ent_num] = []
                    aliases_map[ent_num].append(alt_name)
        
        # Read addresses/nationalities
        print("   Loading nationalities...")
        nationality_map = {}
        with open(add_file, 'r', encoding='latin-1') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 5:
                    continue
                ent_num = row[0].strip()
                country = row[4].strip()
                
                if ent_num and country and country != '-0-':
                    if ent_num not in nationality_map:
                        nationality_map[ent_num] = set()
                    nationality_map[ent_num].add(country)
        
        # Parse main SDN file
        print("   Parsing main SDN list...")
        sanctions = []
        with open(sdn_file, 'r', encoding='latin-1') as f:
            reader = csv.reader(f)
            for row in reader:
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
                    "is_pep": False
                }
                sanctions.append(sanction)
        
        print(f"   ✓ Parsed {len(sanctions)} OFAC sanctions entries")
        return sanctions
    except Exception as e:
        print(f"   ✗ Error parsing OFAC sanctions: {e}")
        import traceback
        traceback.print_exc()
        return []

def fetch_pep_data():
    """
    Fetch PEP data from OpenSanctions, filtered by target countries.
    """
    print("\n🎩 Fetching PEP data from OpenSanctions...")
    print(f"   Target regions: MENA countries")
    
    try:
        response = download_file(OPENSANCTIONS_PEP_URL, "temp_peps.json", stream=True)
        if not response:
            return []
        
        peps = []
        total_processed = 0
        filtered_count = 0
        
        print("   Processing PEP records...")
        
        for line in response.iter_lines():
            if not line:
                continue
            
            total_processed += 1
            if total_processed % 10000 == 0:
                print(f"      Processed {total_processed} records, kept {filtered_count}...")
            
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
                    if any(target in country_str for target in TARGET_COUNTRIES):
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
                    "date_of_birth_text": properties.get('birthDate', [None])[0]
                }
                peps.append(pep)
                
            except json.JSONDecodeError:
                continue
            except Exception as e:
                continue
        
        print(f"   ✓ Filtered {filtered_count} PEP entries from {total_processed} total records")
        return peps
        
    except Exception as e:
        print(f"   ✗ Error fetching PEP data: {e}")
        import traceback
        traceback.print_exc()
        return []

def save_optimized_json(data, output_file, data_type):
    """Save data to optimized JSON format."""
    print(f"\n💾 Saving {data_type} to {output_file.name}...")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                "metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "count": len(data),
                    "type": data_type,
                    "version": "1.0"
                },
                "data": data
            }, f, ensure_ascii=False, indent=2)
        
        file_size = output_file.stat().st_size / 1024
        print(f"   ✓ Saved {len(data)} entries ({file_size:.1f} KB)")
        return True
    except Exception as e:
        print(f"   ✗ Error saving {data_type}: {e}")
        return False

def main():
    """Main execution function."""
    print("=" * 70)
    print("  COMPLIANCE AI PRO - DATA DOWNLOAD & PARSE")
    print("=" * 70)
    print(f"\n📂 Data directory: {DATA_DIR}")
    print(f"🎯 Target: UN + OFAC sanctions + MENA PEPs\n")
    
    # Step 1: Download UN Sanctions
    print("\n" + "="*70)
    print("STEP 1: UN SANCTIONS")
    print("="*70)
    un_xml = download_file(UN_SANCTIONS_URL, "un_consolidated.xml")
    
    # Step 2: Download OFAC Sanctions (3 files)
    print("\n" + "="*70)
    print("STEP 2: OFAC SANCTIONS")
    print("="*70)
    ofac_sdn = download_file(OFAC_SDN_URL, "ofac_sdn.csv")
    ofac_alt = download_file(OFAC_ALT_URL, "ofac_alt.csv")
    ofac_add = download_file(OFAC_ADD_URL, "ofac_add.csv")
    
    # Step 3: Parse sanctions data
    print("\n" + "="*70)
    print("STEP 3: PARSING SANCTIONS")
    print("="*70)
    all_sanctions = []
    
    if un_xml and un_xml.exists():
        un_sanctions = parse_un_sanctions(un_xml)
        all_sanctions.extend(un_sanctions)
    
    if ofac_sdn and ofac_sdn.exists() and ofac_alt and ofac_add:
        ofac_sanctions = parse_ofac_sanctions(ofac_sdn, ofac_alt, ofac_add)
        all_sanctions.extend(ofac_sanctions)
    
    # Step 4: Fetch and filter PEP data
    print("\n" + "="*70)
    print("STEP 4: FETCHING PEP DATA")
    print("="*70)
    pep_data = fetch_pep_data()
    
    # Step 5: Save optimized JSON files
    print("\n" + "="*70)
    print("STEP 5: SAVING OUTPUT FILES")
    print("="*70)
    sanctions_saved = save_optimized_json(all_sanctions, SANCTIONS_OUTPUT, "sanctions")
    pep_saved = save_optimized_json(pep_data, PEP_OUTPUT, "pep")
    
    # Summary
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"✅ Sanctions entries: {len(all_sanctions):,}")
    print(f"✅ PEP entries: {len(pep_data):,}")
    print(f"\n📁 Output files:")
    print(f"   • {SANCTIONS_OUTPUT}")
    print(f"   • {PEP_OUTPUT}")
    
    if sanctions_saved and pep_saved:
        print("\n" + "=" * 70)
        print("✅ DATA DOWNLOAD AND PARSING COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print("\n📌 Next step: Run the following command to load data into Supabase:")
        print("   curl -X POST http://localhost:5000/api/load-data")
        print("\n⚠️  Make sure your Node.js server is running first!")
        return 0
    else:
        print("\n" + "=" * 70)
        print("⚠️  SOME ERRORS OCCURRED DURING PROCESSING")
        print("=" * 70)
        return 1

if __name__ == "__main__":
    sys.exit(main())
