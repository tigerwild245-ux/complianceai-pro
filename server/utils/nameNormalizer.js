const phoneticMatchers = require('./phoneticMatchers');

// Add NYSIIS to your matching suite
function phoneticMatch(name1, name2) {
  const soundexMatch = phoneticMatchers.soundex(name1) === phoneticMatchers.soundex(name2);
  const metaphoneMatch = phoneticMatchers.metaphone(name1) === phoneticMatchers.metaphone(name2);
  const nysiisMatch = phoneticMatchers.nysiis(name1) === phoneticMatchers.nysiis(name2);
  
  // If any 2 of 3 phonetic algorithms match, consider it a match
  const matches = [soundexMatch, metaphoneMatch, nysiisMatch].filter(Boolean).length;
  
  return {
    match: matches >= 2,
    confidence: matches / 3,
    details: { soundexMatch, metaphoneMatch, nysiisMatch }
  };
}