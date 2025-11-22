const { generateArabicVariants } = require('./arabicTransliterator');

const testNames = [
  'Mohamed Emam',
  'Mohammed Ali',
  'Abdul Rahman',
  'Abdel Aziz'
];

console.log('🧪 Testing Arabic Transliterator\n');

testNames.forEach(name => {
  const variants = generateArabicVariants(name);
  console.log(`\n📝 Input: "${name}"`);
  console.log(`✅ Variants (${variants.length}):`, variants);
});
