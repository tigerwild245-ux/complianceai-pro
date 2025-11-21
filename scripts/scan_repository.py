import os
import re
from pathlib import Path
import json

class RepositoryScanner:
    """
    Scans repository to verify implementation of core features:
    - Core Logical Matching
    - Fuzzy Matching
    - Phonetic Matching
    - AI Analysis
    - AI Risk Assessment
    - PEP Bio Generation
    """
    
    def __init__(self, repo_path):
        self.repo_path = Path(repo_path)
        self.results = {
            "core_logical": {},
            "fuzzy_matching": {},
            "phonetic_matching": {},
            "ai_analysis": {},
            "ai_risk_assessment": {},
            "pep_bio_generation": {},
            "missing_features": []
        }
    
    def scan_repository(self):
        """Main scanning function"""
        print("=" * 80)
        print("REPOSITORY FEATURE SCAN")
        print("=" * 80)
        print(f"Scanning: {self.repo_path}\n")
        
        # Scan each feature category
        self.scan_core_logical()
        self.scan_fuzzy_matching()
        self.scan_phonetic_matching()
        self.scan_ai_analysis()
        self.scan_ai_risk_assessment()
        self.scan_pep_bio_generation()
        
        # Generate report
        self.generate_report()
        
        return self.results
    
    def scan_core_logical(self):
        """Scan for core logical matching features"""
        print("\n[1] CORE LOGICAL MATCHING")
        print("-" * 80)
        
        features = {
            "exact_name_match": [
                "def exact_match", "def normalize_name", "def compare_names"
            ],
            "dob_matching": [
                "def match_dob", "def parse_dob", "def compare_dates"
            ],
            "nationality_matching": [
                "def match_nationality", "def compare_nationality"
            ],
            "id_document_matching": [
                "def match_passport", "def match_id", "def compare_document"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["core_logical"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:3]:  # Show first 3 files
                    print(f"    - {file}")
    
    def scan_fuzzy_matching(self):
        """Scan for fuzzy matching features"""
        print("\n[2] FUZZY MATCHING")
        print("-" * 80)
        
        features = {
            "levenshtein": [
                "levenshtein", "edit_distance", "from Levenshtein import"
            ],
            "jaro_winkler": [
                "jaro_winkler", "jaro", "jellyfish"
            ],
            "token_based": [
                "token_sort", "token_set", "fuzz.token", "rapidfuzz"
            ],
            "ngram": [
                "ngram", "n_gram", "generate_ngrams"
            ],
            "threshold_config": [
                "threshold", "similarity_threshold", "match_threshold"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["fuzzy_matching"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:2]:
                    print(f"    - {file}")
    
    def scan_phonetic_matching(self):
        """Scan for phonetic matching features"""
        print("\n[3] PHONETIC MATCHING")
        print("-" * 80)
        
        features = {
            "soundex": [
                "soundex", "def soundex", "soundex_encode"
            ],
            "metaphone": [
                "metaphone", "double_metaphone", "def metaphone"
            ],
            "nysiis": [
                "nysiis", "def nysiis"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["phonetic_matching"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:2]:
                    print(f"    - {file}")
    
    def scan_ai_analysis(self):
        """Scan for AI analysis features"""
        print("\n[4] AI ANALYSIS")
        print("-" * 80)
        
        features = {
            "nlp_ner": [
                "import spacy", "nlp =", "ner", "named_entity", "entity_recognition"
            ],
            "embeddings": [
                "sentence_transformers", "SentenceTransformer", "embeddings", 
                "encode(", "model.encode"
            ],
            "ml_classifier": [
                "from sklearn", "RandomForest", "XGBoost", "classifier", 
                "train_model", "predict"
            ],
            "transformers": [
                "from transformers import", "AutoModel", "bert", "BERT"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["ai_analysis"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:2]:
                    print(f"    - {file}")
    
    def scan_ai_risk_assessment(self):
        """Scan for AI Risk Assessment features"""
        print("\n[5] AI RISK ASSESSMENT")
        print("-" * 80)
        
        features = {
            "risk_scoring": [
                "risk_score", "calculate_risk", "risk_assessment", 
                "def assess_risk", "risk_level"
            ],
            "risk_factors": [
                "risk_factor", "risk_weight", "risk_criteria"
            ],
            "risk_classification": [
                "risk_class", "classify_risk", "high_risk", "low_risk", "medium_risk"
            ],
            "risk_reporting": [
                "risk_report", "generate_risk", "risk_output"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["ai_risk_assessment"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:2]:
                    print(f"    - {file}")
    
    def scan_pep_bio_generation(self):
        """Scan for PEP Bio Generation features"""
        print("\n[6] PEP BIO GENERATION")
        print("-" * 80)
        
        features = {
            "bio_generator": [
                "generate_bio", "create_bio", "bio_generation", 
                "def generate_biography"
            ],
            "pep_profile": [
                "pep_profile", "political_exposure", "pep_data", "pep_info"
            ],
            "data_extraction": [
                "extract_bio", "parse_bio", "bio_parser", "extract_profile"
            ],
            "bio_formatting": [
                "format_bio", "structure_bio", "bio_template"
            ]
        }
        
        for feature, patterns in features.items():
            found = self.search_patterns(patterns)
            self.results["pep_bio_generation"][feature] = found
            status = "✓ FOUND" if found["files"] else "✗ MISSING"
            print(f"  {status}: {feature}")
            if found["files"]:
                for file in found["files"][:2]:
                    print(f"    - {file}")
    
    def search_patterns(self, patterns):
        """Search for patterns in repository files"""
        found_files = []
        found_lines = []
        
        for root, dirs, files in os.walk(self.repo_path):
            # Skip common non-code directories
            dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'node_modules', '.venv', 'venv']]
            
            for file in files:
                if file.endswith(('.py', '.js', '.ts', '.java', '.go', '.rs')):
                    file_path = Path(root) / file
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            for pattern in patterns:
                                if pattern.lower() in content.lower():
                                    rel_path = file_path.relative_to(self.repo_path)
                                    if str(rel_path) not in found_files:
                                        found_files.append(str(rel_path))
                                    
                                    # Find line numbers
                                    for i, line in enumerate(content.split('\n'), 1):
                                        if pattern.lower() in line.lower():
                                            found_lines.append({
                                                "file": str(rel_path),
                                                "line": i,
                                                "content": line.strip()[:80]
                                            })
                                    break
                    except Exception as e:
                        pass
        
        return {
            "files": found_files,
            "matches": len(found_lines),
            "lines": found_lines[:5]  # Limit to 5 examples
        }
    
    def generate_report(self):
        """Generate comprehensive report"""
        print("\n" + "=" * 80)
        print("SUMMARY REPORT")
        print("=" * 80)
        
        all_categories = [
            ("Core Logical", self.results["core_logical"]),
            ("Fuzzy Matching", self.results["fuzzy_matching"]),
            ("Phonetic Matching", self.results["phonetic_matching"]),
            ("AI Analysis", self.results["ai_analysis"]),
            ("AI Risk Assessment", self.results["ai_risk_assessment"]),
            ("PEP Bio Generation", self.results["pep_bio_generation"])
        ]
        
        for category_name, category_data in all_categories:
            implemented = sum(1 for v in category_data.values() if v.get("files"))
            total = len(category_data)
            percentage = (implemented / total * 100) if total > 0 else 0
            
            print(f"\n{category_name}:")
            print(f"  Implemented: {implemented}/{total} ({percentage:.1f}%)")
            
            # List missing features
            missing = [k for k, v in category_data.items() if not v.get("files")]
            if missing:
                print(f"  Missing: {', '.join(missing)}")
        
        # Overall statistics
        print("\n" + "=" * 80)
        total_features = sum(len(cat[1]) for cat in all_categories)
        implemented_features = sum(
            sum(1 for v in cat[1].values() if v.get("files")) 
            for cat in all_categories
        )
        overall_percentage = (implemented_features / total_features * 100) if total_features > 0 else 0
        
        print(f"OVERALL IMPLEMENTATION: {implemented_features}/{total_features} ({overall_percentage:.1f}%)")
        print("=" * 80)
    
    def export_json(self, output_file="scan_results.json"):
        """Export results to JSON"""
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\nResults exported to: {output_file}")


# Usage
if __name__ == "__main__":
    # Replace with your repository path
    REPO_PATH = "."  # Current directory or specify: "/path/to/your/repo"
    
    scanner = RepositoryScanner(REPO_PATH)
    results = scanner.scan_repository()
    
    # Export results
    scanner.export_json("feature_scan_results.json")
    
    print("\n✓ Scan complete!")
    print("\nNext steps:")
    print("1. Review the scan results above")
    print("2. Check 'feature_scan_results.json' for detailed findings")
    print("3. Implement missing features as needed")