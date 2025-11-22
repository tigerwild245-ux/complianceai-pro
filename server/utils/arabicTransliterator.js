/**
 * Generate Arabic name transliteration variants
 * Handles common Arabic-to-English spelling variations
 */

// Vowel variations mapping
const VOWEL_VARIATIONS = {
  'u': ['o', 'ou', 'oo'],      // Subhy → Sobhy, Subhi → Sobhi
  'o': ['u', 'ou', 'oo'],      // Reverse
  'i': ['e', 'ee', 'ie', 'a', 'y'], // Hadi → Hady, Hadi → Hade
  'e': ['i', 'ee', 'ie', 'a'], // Reverse
  'a': ['e', 'i', 'aa', 'ai']  // Ahmad → Ahmed, Ahmad → Ahmid
};

// Consonant variations mapping
const CONSONANT_VARIATIONS = {
  'h': ['ah', 'eh', 'ih', ''],  // Ahmed → Aahmed, or remove h
  's': ['ss', 'c', 'z'],        // Hassan → Hasan, Hassan → Hacan
  'd': ['dd', 'dh', 't'],       // Abdullah → Abdulla, Said → Saeed
  'k': ['c', 'q', 'ck'],        // Karim → Carim, Karim → Qarim
  'z': ['s', 'zz'],             // Aziz → Asis, Aziz → Azziz
  'g': ['gh', 'j'],             // Ragab → Raghab, Gamal → Jamal
  'q': ['k', 'c']               // Qasim → Kasim, Qasim → Casim
};

function generateArabicVariants(name) {
  if (!name || typeof name !== 'string') return [];
  
  const variants = new Set([name.trim()]); // Start with original name
  
  // Common Arabic name patterns
  const namePatterns = [
    // Mohamed variations (most common)
    { from: /\bMohamed\b/gi, to: ['Mohammed', 'Muhammad', 'Muhammed', 'Mohamad', 'Mohamed'] },
    { from: /\bMohammed\b/gi, to: ['Mohamed', 'Muhammad', 'Muhammed', 'Mohamad'] },
    { from: /\bMuhammad\b/gi, to: ['Mohamed', 'Mohammed', 'Muhammed', 'Mohamad'] },
    { from: /\bMuhammed\b/gi, to: ['Mohamed', 'Mohammed', 'Muhammad', 'Mohamad'] },
    
    // Abdul/Abdel variations
    { from: /\bAbdul\b/gi, to: ['Abdel', 'Abd-el', 'Abdal', 'Abd al', 'Abdu'] },
    { from: /\bAbdel\b/gi, to: ['Abdul', 'Abd-el', 'Abdal', 'Abd al', 'Abdu'] },
    { from: /\bAbd al\b/gi, to: ['Abdul', 'Abdel', 'Abd-el', 'Abdal'] },
    
    // Common prefixes
    { from: /\bAl[\s-]/gi, to: ['El-', 'Al-', 'El ', 'Al '] },
    { from: /\bEl[\s-]/gi, to: ['Al-', 'El-', 'Al ', 'El '] },
    
    // Double letters
    { from: /ss/gi, to: ['s'] },
    { from: /mm/gi, to: ['m'] },
    { from: /dd/gi, to: ['d'] },
    { from: /ll/gi, to: ['l'] },
    
    // Common endings
    { from: /ah$/gi, to: ['a', 'eh'] },
    { from: /eh$/gi, to: ['a', 'ah'] },
  ];
  
  // Apply name patterns
  namePatterns.forEach(pattern => {
    const currentVariants = Array.from(variants);
    currentVariants.forEach(variant => {
      if (pattern.from.test(variant)) {
        pattern.to.forEach(replacement => {
          const newVariant = variant.replace(pattern.from, replacement);
          if (newVariant && newVariant.length > 0) {
            variants.add(newVariant);
          }
        });
      }
    });
  });
  
  // Apply vowel variations
  const withVowelVariations = new Set(variants);
  Array.from(variants).forEach(variant => {
    Object.keys(VOWEL_VARIATIONS).forEach(vowel => {
      if (variant.toLowerCase().includes(vowel)) {
        VOWEL_VARIATIONS[vowel].forEach(replacement => {
          // Replace all occurrences
          const newVariant = variant.replace(new RegExp(vowel, 'gi'), replacement);
          if (newVariant && newVariant !== variant) {
            withVowelVariations.add(newVariant);
          }
        });
      }
    });
  });
  
  // Apply consonant variations
  const withConsonantVariations = new Set(withVowelVariations);
  Array.from(withVowelVariations).forEach(variant => {
    Object.keys(CONSONANT_VARIATIONS).forEach(consonant => {
      if (variant.toLowerCase().includes(consonant)) {
        CONSONANT_VARIATIONS[consonant].forEach(replacement => {
          const newVariant = variant.replace(new RegExp(consonant, 'gi'), replacement);
          if (newVariant && newVariant !== variant && newVariant.length > 2) {
            withConsonantVariations.add(newVariant);
          }
        });
      }
    });
  });
  
  // Clean up and return
  return Array.from(withConsonantVariations)
    .filter(v => v && v.trim().length > 2) // Remove empty or too short
    .filter(v => !/^\d+$/.test(v)) // Remove pure numbers
    .slice(0, 100); // Limit to 100 variants to avoid explosion
}

/**
 * Generate targeted variants for specific name parts
 */
function generateTargetedVariants(name) {
  const parts = name.split(' ');
  const variantParts = parts.map(part => generateArabicVariants(part));
  
  // Combine all possible combinations (limited)
  const combinations = [];
  const maxCombinations = 50;
  
  function combine(index, current) {
    if (index === variantParts.length) {
      combinations.push(current.join(' '));
      return;
    }
    if (combinations.length >= maxCombinations) return;
    
    for (const variant of variantParts[index].slice(0, 5)) { // Limit each part to 5 variants
      combine(index + 1, [...current, variant]);
    }
  }
  
  combine(0, []);
  return combinations;
}

module.exports = { 
  generateArabicVariants,
  generateTargetedVariants,
  VOWEL_VARIATIONS,
  CONSONANT_VARIATIONS
};
