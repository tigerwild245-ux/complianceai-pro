import os
import re
from pathlib import Path
import json

class DeepRepositoryVerifier:
    """
    Deep verification of actual feature implementations
    Excludes the scanner script itself to avoid false positives
    """
    
    def __init__(self, repo_path):
        self.repo_path = Path(repo_path)
        self.results = {
            "implemented_features": {},
            "missing_features": [],
            "file_inventory": {},
            "recommendations": []
        }
        # Exclude scanner files from search
        self.exclude_files = ['scan_repository.py', 'deep_repo_scanner.py']
    
    def scan_deep(self):
        """Deep scan with actual implementation verification"""
        print("=" * 80)
        print("DEEP REPOSITORY IMPLEMENTATION VERIFICATION")
        print("=" * 80)
        print(f"Repository: {self.repo_path}\n")
        
        # First, get file inventory
        self.get_file_inventory()
        
        # Verify each feature with strict criteria
        self.verify_core_logical_implementation()
        self.verify_fuzzy_matching_implementation()
        self.verify_phonetic_implementation()
        self.verify_ai_analysis_implementation()
        self.verify_risk_assessment_implementation()
        self.verify_pep_bio_implementation()
        
        # Generate comprehensive report
        self.generate_detailed_report()
        
        return self.results
    
    def get_file_inventory(self):
        """Get complete file inventory"""
        print("\n📁 FILE INVENTORY")
        print("-" * 80)
        
        file_types = {
            'python': [],
            'javascript': [],
            'config': [],
            'data': []
        }
        
        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'node_modules', '.venv', 'venv', 'dist', 'build']]
            
            for file in files:
                if file in self.exclude_files:
                    continue
                    
                file_path = Path(root) / file
                rel_path = str(file_path.relative_to(self.repo_path))
                
                if file.endswith('.py'):
                    file_types['python'].append(rel_path)
                elif file.endswith(('.js', '.ts', '.jsx', '.tsx')):
                    file_types['javascript'].append(rel_path)
                elif file.endswith(('.json', '.yaml', '.yml', '.env', '.ini')):
                    file_types['config'].append(rel_path)
                elif file.endswith(('.csv', '.xml', '.txt', '.dat')):
                    file_types['data'].append(rel_path)
        
        self.results['file_inventory'] = file_types
        
        print(f"Python files: {len(file_types['python'])}")
        print(f"JavaScript files: {len(file_types['javascript'])}")
        print(f"Config files: {len(file_types['config'])}")
        print(f"Data files: {len(file_types['data'])}")
    
    def verify_core_logical_implementation(self):
        """Verify core logical matching with actual function implementations"""
        print("\n\n🔍 [1] CORE LOGICAL MATCHING - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "exact_name_matching": {
                "required_functions": [
                    r"def\s+.*normalize.*name",
                    r"def\s+.*exact.*match",
                    r"def\s+.*compare.*name"
                ],
                "required_logic": ["toLowerCase", "trim", "replace"],
                "files_found": []
            },
            "dob_matching": {
                "required_functions": [
                    r"def\s+.*parse.*dob",
                    r"def\s+.*match.*dob",
                    r"def\s+.*compare.*date"
                ],
                "required_logic": ["date", "Date", "parse", "year", "month", "day"],
                "files_found": []
            },
            "nationality_matching": {
                "required_functions": [
                    r"def\s+.*match.*national",
                    r"def\s+.*compare.*country"
                ],
                "required_logic": ["nationality", "country", "citizenship"],
                "files_found": []
            },
            "id_document_matching": {
                "required_functions": [
                    r"def\s+.*match.*passport",
                    r"def\s+.*match.*id",
                    r"def\s+.*document"
                ],
                "required_logic": ["passport", "national_id", "document_number"],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"])
            features[feature_name]["files_found"] = found["files"]
            features[feature_name]["implementation_score"] = found["score"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:3]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"core_logical.{feature_name}")
        
        self.results["implemented_features"]["core_logical"] = features
    
    def verify_fuzzy_matching_implementation(self):
        """Verify fuzzy matching algorithms"""
        print("\n\n🔍 [2] FUZZY MATCHING - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "levenshtein_distance": {
                "required_functions": [r"def\s+.*levenshtein", r"edit.*distance"],
                "required_logic": ["distance", "matrix", "dp"],
                "imports": ["Levenshtein", "python-Levenshtein"],
                "files_found": []
            },
            "jaro_winkler": {
                "required_functions": [r"def\s+.*jaro"],
                "required_logic": ["jaro", "winkler", "similarity"],
                "imports": ["jellyfish", "jaro"],
                "files_found": []
            },
            "token_based_matching": {
                "required_functions": [r"def\s+.*token"],
                "required_logic": ["token", "split", "sort"],
                "imports": ["fuzzywuzzy", "rapidfuzz"],
                "files_found": []
            },
            "ngram_similarity": {
                "required_functions": [r"def\s+.*ngram", r"generate.*ngram"],
                "required_logic": ["ngram", "n-gram", "substring"],
                "imports": [],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"], criteria["imports"])
            features[feature_name]["files_found"] = found["files"]
            features[feature_name]["implementation_score"] = found["score"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:2]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"fuzzy_matching.{feature_name}")
        
        self.results["implemented_features"]["fuzzy_matching"] = features
    
    def verify_phonetic_implementation(self):
        """Verify phonetic algorithms"""
        print("\n\n🔍 [3] PHONETIC MATCHING - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "soundex": {
                "required_functions": [r"def\s+.*soundex", r"soundex.*encode"],
                "required_logic": ["soundex", "encode", "phonetic"],
                "files_found": []
            },
            "metaphone": {
                "required_functions": [r"def\s+.*metaphone"],
                "required_logic": ["metaphone", "double_metaphone"],
                "files_found": []
            },
            "nysiis": {
                "required_functions": [r"def\s+.*nysiis"],
                "required_logic": ["nysiis"],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"])
            features[feature_name]["files_found"] = found["files"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:2]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"phonetic.{feature_name}")
        
        self.results["implemented_features"]["phonetic"] = features
    
    def verify_ai_analysis_implementation(self):
        """Verify AI/ML implementations"""
        print("\n\n🔍 [4] AI ANALYSIS - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "nlp_ner": {
                "required_functions": [r"def\s+.*extract.*entit", r"def\s+.*recognize"],
                "required_logic": ["ner", "entity", "spacy", "nlp"],
                "imports": ["spacy", "en_core_web"],
                "files_found": []
            },
            "semantic_embeddings": {
                "required_functions": [r"def\s+.*embed", r"def\s+.*encode"],
                "required_logic": ["embedding", "vector", "semantic", "cosine"],
                "imports": ["sentence-transformers", "SentenceTransformer"],
                "files_found": []
            },
            "ml_classification": {
                "required_functions": [r"def\s+.*train", r"def\s+.*predict", r"def\s+.*classify"],
                "required_logic": ["classifier", "model", "fit", "predict"],
                "imports": ["sklearn", "xgboost", "RandomForest"],
                "files_found": []
            },
            "transformers": {
                "required_functions": [r"def\s+.*transform"],
                "required_logic": ["transformer", "bert", "AutoModel"],
                "imports": ["transformers", "torch"],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"], criteria.get("imports", []))
            features[feature_name]["files_found"] = found["files"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:2]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"ai_analysis.{feature_name}")
        
        self.results["implemented_features"]["ai_analysis"] = features
    
    def verify_risk_assessment_implementation(self):
        """Verify risk assessment implementation"""
        print("\n\n🔍 [5] AI RISK ASSESSMENT - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "risk_scoring_engine": {
                "required_functions": [r"def\s+.*calculate.*risk", r"def\s+.*assess.*risk", r"def\s+.*risk.*score"],
                "required_logic": ["risk", "score", "calculate", "weight"],
                "files_found": []
            },
            "risk_factors_analysis": {
                "required_functions": [r"def\s+.*risk.*factor", r"def\s+.*analyze"],
                "required_logic": ["factor", "weight", "criteria", "threshold"],
                "files_found": []
            },
            "risk_classification": {
                "required_functions": [r"def\s+.*classify.*risk", r"def\s+.*categorize"],
                "required_logic": ["high", "medium", "low", "classification"],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"])
            features[feature_name]["files_found"] = found["files"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:2]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"risk_assessment.{feature_name}")
        
        self.results["implemented_features"]["risk_assessment"] = features
    
    def verify_pep_bio_implementation(self):
        """Verify PEP bio generation"""
        print("\n\n🔍 [6] PEP BIO GENERATION - DEEP VERIFICATION")
        print("-" * 80)
        
        features = {
            "bio_generation_engine": {
                "required_functions": [r"def\s+.*generate.*bio", r"def\s+.*create.*bio"],
                "required_logic": ["biography", "generate", "profile", "pep"],
                "files_found": []
            },
            "pep_data_extraction": {
                "required_functions": [r"def\s+.*extract.*pep", r"def\s+.*parse.*pep"],
                "required_logic": ["extract", "parse", "pep", "profile"],
                "files_found": []
            },
            "bio_formatting": {
                "required_functions": [r"def\s+.*format.*bio", r"def\s+.*structure"],
                "required_logic": ["format", "template", "structure"],
                "files_found": []
            }
        }
        
        for feature_name, criteria in features.items():
            found = self.deep_search(criteria["required_functions"], criteria["required_logic"])
            features[feature_name]["files_found"] = found["files"]
            
            if found["files"]:
                print(f"  ✓ {feature_name}: IMPLEMENTED")
                for file in found["files"][:2]:
                    print(f"      └─ {file}")
            else:
                print(f"  ✗ {feature_name}: NOT FOUND")
                self.results["missing_features"].append(f"pep_bio.{feature_name}")
        
        self.results["implemented_features"]["pep_bio"] = features
    
    def deep_search(self, function_patterns, logic_keywords, import_patterns=None):
        """Deep search with multiple criteria"""
        found_files = set()
        score = 0
        max_score = len(function_patterns) + len(logic_keywords)
        if import_patterns:
            max_score += len(import_patterns)
        
        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'node_modules', '.venv', 'venv']]
            
            for file in files:
                if file in self.exclude_files:
                    continue
                
                if file.endswith(('.py', '.js', '.ts')):
                    file_path = Path(root) / file
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            
                            # Check function patterns
                            for pattern in function_patterns:
                                if re.search(pattern, content, re.IGNORECASE):
                                    score += 1
                                    rel_path = str(file_path.relative_to(self.repo_path))
                                    found_files.add(rel_path)
                            
                            # Check logic keywords
                            for keyword in logic_keywords:
                                if keyword.lower() in content.lower():
                                    score += 0.5
                                    rel_path = str(file_path.relative_to(self.repo_path))
                                    found_files.add(rel_path)
                            
                            # Check imports
                            if import_patterns:
                                for imp in import_patterns:
                                    if imp.lower() in content.lower():
                                        score += 1
                                        rel_path = str(file_path.relative_to(self.repo_path))
                                        found_files.add(rel_path)
                    except Exception:
                        pass
        
        return {
            "files": sorted(list(found_files)),
            "score": min(score / max_score * 100, 100) if max_score > 0 else 0
        }
    
    def generate_detailed_report(self):
        """Generate detailed implementation report"""
        print("\n\n" + "=" * 80)
        print("DETAILED IMPLEMENTATION REPORT")
        print("=" * 80)
        
        categories = [
            "core_logical", "fuzzy_matching", "phonetic", 
            "ai_analysis", "risk_assessment", "pep_bio"
        ]
        
        total_features = 0
        implemented_features = 0
        
        for category in categories:
            if category in self.results["implemented_features"]:
                cat_data = self.results["implemented_features"][category]
                cat_total = len(cat_data)
                cat_implemented = sum(1 for v in cat_data.values() if v.get("files_found"))
                
                total_features += cat_total
                implemented_features += cat_implemented
                
                percentage = (cat_implemented / cat_total * 100) if cat_total > 0 else 0
                print(f"\n{category.upper().replace('_', ' ')}:")
                print(f"  Status: {cat_implemented}/{cat_total} ({percentage:.1f}%)")
                
                missing = [k for k, v in cat_data.items() if not v.get("files_found")]
                if missing:
                    print(f"  ⚠️  Missing: {', '.join(missing)}")
        
        print("\n" + "=" * 80)
        overall = (implemented_features / total_features * 100) if total_features > 0 else 0
        print(f"OVERALL: {implemented_features}/{total_features} features ({overall:.1f}%)")
        print("=" * 80)
        
        if self.results["missing_features"]:
            print("\n⚠️  MISSING FEATURES THAT NEED IMPLEMENTATION:")
            for feature in self.results["missing_features"]:
                print(f"   - {feature}")
        else:
            print("\n✅ All features appear to be implemented!")
    
    def export_results(self, filename="deep_scan_results.json"):
        """Export detailed results"""
        output = {
            "file_inventory": self.results["file_inventory"],
            "implemented_features": {},
            "missing_features": self.results["missing_features"]
        }
        
        # Simplify for JSON export
        for category, features in self.results["implemented_features"].items():
            output["implemented_features"][category] = {}
            for feature_name, feature_data in features.items():
                output["implemented_features"][category][feature_name] = {
                    "implemented": len(feature_data.get("files_found", [])) > 0,
                    "files": feature_data.get("files_found", []),
                    "score": feature_data.get("implementation_score", 0)
                }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"\n📄 Detailed results exported to: {filename}")


if __name__ == "__main__":
    REPO_PATH = "."
    
    verifier = DeepRepositoryVerifier(REPO_PATH)
    results = verifier.scan_deep()
    verifier.export_results("deep_scan_results.json")
    
    print("\n✓ Deep verification complete!")
    print("\nRecommended next steps:")
    print("1. Review missing features above")
    print("2. Check deep_scan_results.json for full details")
    print("3. Prioritize implementation of critical missing features")