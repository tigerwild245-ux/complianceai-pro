const { phoneticMatch } = require('./phoneticHelper');

const testPairs = [
  ['Mohamed Ali', 'Muhammad Ali'],
  ['Hassan', 'Hasan'],
  ['Smith', 'Smythe'],
  ['John', 'Jon'],
  ['Ahmed', 'Ahmad']
];

console.log('🎵 Testing Phonetic Matching\n');

testPairs.forEach(([name1, name2]) => {
  const result = phoneticMatch(name1, name2);
  console.log(`\n"${name1}" vs "${name2}":`);
  console.log(`  Match: ${result.match ? '✅' : '❌'}`);
  console.log(`  Algorithms: ${result.matchCount}/3`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
});
