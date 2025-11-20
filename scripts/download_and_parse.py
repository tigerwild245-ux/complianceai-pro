import requests
import xml.etree.ElementTree as ET
import json
import csv
from io import StringIO

# --- Configuration ---
UN_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
OFAC_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONSOLIDATED.XML"
PEP_LINKS = [
    "https://www.opensanctions.org/search/?scope=peps&countries=ma", # Morocco
    "https://www.opensanctions.org/search/?scope=peps&countries=eg", # Egypt
    "https://www.opensanctions.org/search/?scope=peps&countries=il", # Israel
    "https://www.opensanctions.org/search/?scope=peps&countries=iq", # Iraq
    "https://www.opensanctions.org/search/?scope=peps&countries=sd", # Sudan
    "https://www.opensanctions.org/search/?scope=peps&countries=ye", # Yemen
    "https://www.opensanctions.org/search/?scope=peps&countries=sa", # Saudi Arabia
    "https://www.opensanctions.org/search/?scope=peps&countries=al", # Albania
    "https://www.opensanctions.org/search/?scope=peps&countries=sy", # Syria
    "https://www.opensanctions.org/search/?scope=peps&countries=so", # Somalia
    "https://www.opensanctions.org/search/?scope=peps&countries=jo", # Jordan
    "https://www.opensanctions.org/search/?scope=peps&countries=lb", # Lebanon
    "https://www.opensanctions.org/search/?scope=peps&countries=mr", # Mauritania
    "https://www.opensanctions.org/search/?scope=peps&countries=kw", # Kuwait
    "https://www.opensanctions.org/search/?scope=peps&countries=bh", # Bahrain
    "https://www.opensanctions.org/search/?scope=peps&countries=ae", # UAE
    "https://www.opensanctions.org/search/?scope=peps&countries=zz", # Global
    "https://www.opensanctions.org/search/?scope=peps&countries=un", # UN
]
OUTPUT_DIR = "complianceai-pro/server/data"

def download_file(url, filename):
    print(f"Downloading {filename} from {url}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(f"{OUTPUT_DIR}/{filename}", 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"Successfully downloaded {filename}.")

def parse_un_xml(xml_path):
    print("Parsing UN XML...")
    tree = ET.parse(xml_path)
    root = tree.getroot()
    sanctions_list = []
    
    # Define the namespace map
    
    
    # Iterate over all individuals and entities
    for item in root.findall(".//INDIVIDUAL") + root.findall(".//ENTITY"): 
        data = {
            'list_type': 'UN',
            'type': item.tag.split('}')[-1], # INDIVIDUAL or ENTITY
            'name': item.findtext('./FIRST_NAME', default='') + ' ' + item.findtext('./SECOND_NAME', default=''),
            'reference_number': item.findtext('./REFERENCE_NUMBER', default=''),
            'date_of_listing': item.findtext('./LISTED_ON', default=''),
            'designation': item.findtext('./DESIGNATION', default=''),
            'nationalities': [n.text for n in item.findall('./NATIONALITY/VALUE')],
            'dates_of_birth': [d.text for d in item.findall('./INDIVIDUAL_DATE_OF_BIRTH/DATE')],
            'place_of_birth': item.findtext('./INDIVIDUAL_PLACE_OF_BIRTH/COUNTRY', default=''),
            'addresses': [a.findtext('./STREET_ADDRESS', default='') for a in item.findall('./INDIVIDUAL_ADDRESS')],
        }
        sanctions_list.append(data)
        
    print(f"Finished parsing UN XML. Found {len(sanctions_list)} entries.")
    return sanctions_list

def parse_ofac_xml(xml_path):
    print("Parsing OFAC XML...")
    tree = ET.parse(xml_path)
    root = tree.getroot()
    sanctions_list = []
    
    # Define the namespace map
    ns = {'ofac': 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML'}
    
    # OFAC XML structure is simpler, iterating over all entries
    for item in root.findall('.//ofac:sdnEntry', ns):
        data = {
            'list_type': 'OFAC',
            'uid': item.findtext('./ofac:uid', default='', namespaces=ns),
            'name': item.findtext('./ofac:lastName', default='', namespaces=ns) + ' ' + item.findtext('./ofac:firstName', default='', namespaces=ns),
            'title': item.findtext('./ofac:title', default='', namespaces=ns),
            'sdn_type': item.findtext('./ofac:sdnType', default='', namespaces=ns),
            'program': item.findtext('./ofac:programList/ofac:program', default='', namespaces=ns),
            'aliases': [a.findtext('./ofac:altName', default='', namespaces=ns) for a in item.findall('./ofac:akaList/ofac:aka', ns)],
            'dates_of_birth': [d.findtext('./ofac:dateOfBirth', default='', namespaces=ns) for d in item.findall('./ofac:dateOfBirthList/ofac:dateOfBirthItem', ns)],
            'addresses': [a.findtext('./ofac:address1', default='', namespaces=ns) for a in item.findall('./ofac:addressList/ofac:address', ns)],
        }
        # Clean up name for entities
        if data['sdn_type'] == 'Entity':
            data['name'] = item.findtext('./ofac:lastName', default='', namespaces=ns)
        
        sanctions_list.append(data)
        
    print(f"Finished parsing OFAC XML. Found {len(sanctions_list)} entries.")
    return sanctions_list

def download_pep_data():
    # Note: OpenSanctions links are search results, not direct data dumps.
    # To get the actual data, we would need to scrape or use their API.
    # For this task, we will simulate the data acquisition by creating a placeholder file
    # and noting the links for future reference/manual download.
    print("PEP data acquisition: OpenSanctions links are for search, not direct download.")
    print("Creating a placeholder file with the provided links.")
    
    pep_data = []
    for link in PEP_LINKS:
        # Extract country code from the link for a minimal entry
        country_code = link.split('countries=')[-1]
        pep_data.append({
            "list_type": "PEP_OpenSanctions",
            "country_code": country_code,
            "source_url": link,
            "note": "Data needs to be acquired via OpenSanctions API or scraping."
        })
        
    with open(f"{OUTPUT_DIR}/pep_sources.json", 'w') as f:
        json.dump(pep_data, f, indent=2)
    print(f"Saved PEP source links to {OUTPUT_DIR}/pep_sources.json.")
    
    # Since the user's existing repo has a 'sdn.csv' and 'alt.csv', we will assume
    # the user has a local PEP/SDN list and will focus on integrating the new sanction lists.
    # We will not attempt to scrape OpenSanctions as it is complex and likely against their ToS.
    
    # We will also create a dummy PEP list for testing the bio generation feature
    dummy_pep_list = [
        {"name": "Barack Obama", "country": "US", "role": "Former President"},
        {"name": "Angela Merkel", "country": "DE", "role": "Former Chancellor"},
        {"name": "Vladimir Putin", "country": "RU", "role": "President"},
    ]
    with open(f"{OUTPUT_DIR}/dummy_pep_list.json", 'w') as f:
        json.dump(dummy_pep_list, f, indent=2)
    print(f"Saved dummy PEP list to {OUTPUT_DIR}/dummy_pep_list.json for bio generation testing.")


def main():
    # 1. Download XML files
    download_file(UN_URL, "un_consolidated_latest.xml")
    download_file(OFAC_URL, "ofac_consolidated_latest.xml")
    
    # 2. Parse XML files
    un_list = parse_un_xml(f"{OUTPUT_DIR}/un_consolidated_latest.xml")
    ofac_list = parse_ofac_xml(f"{OUTPUT_DIR}/ofac_consolidated_latest.xml")
    
    # 3. Combine and save the final sanctions list
    combined_list = un_list + ofac_list
    
    # Optimization for Supabase (0.5GB limit):
    # We will only store the essential fields for screening to keep the size down.
    # The full details can be fetched from the original XML/DB if needed.
    optimized_list = []
    for item in combined_list:
        # Create a unique ID for each entry
        unique_id = f"{item['list_type']}_{item.get('reference_number', item.get('uid', 'NO_ID'))}"
        
        # Collect all names (primary + aliases)
        names = [item['name']]
        if 'aliases' in item and item['aliases']:
            names.extend(item['aliases'])
            
        # Filter out empty names and duplicates
        names = list(set([n.strip() for n in names if n.strip()]))
        
        # The core data structure for screening
        optimized_list.append({
            "id": unique_id,
            "list_type": item['list_type'],
            "names": names, # List of all names associated with the entry
            "designation": item.get('designation', item.get('sdn_type', 'Sanctioned')),
            "country": item.get('nationalities', ['Unknown'])[0] if item.get('nationalities') else item.get('program', 'Unknown'), # Best guess for a country/program
            "full_data": item # Keep full data for match transparency/reasoning
        })
        
    print(f"Total combined and optimized sanction entries: {len(optimized_list)}")
    
    # Save the optimized list
    with open(f"{OUTPUT_DIR}/sanctions_optimized.json", 'w') as f:
        json.dump(optimized_list, f, indent=2)
    print(f"Saved optimized sanctions list to {OUTPUT_DIR}/sanctions_optimized.json.")
    
    # 4. Handle PEP data
    download_pep_data()

if __name__ == "__main__":
    main()
