// server/scripts/debugScreening.js
// Run: node scripts/debugScreening.js

const supabase = require('../config/supabaseClient');

async function debugScreening() {
  console.log('🔍 DEBUG: Testing Screening System\n');
  console.log('='.repeat(60));

  try {
    // TEST 1: Check Supabase connection
    console.log('\n1️⃣ Testing Supabase Connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('sanctions_list')
      .select('id')
      .limit(1);

    if (connectionError) {
      console.error('❌ Supabase connection failed:', connectionError.message);
      return;
    }
    console.log('✅ Supabase connected successfully');

    // TEST 2: Check if match_sanctions function exists
    console.log('\n2️⃣ Testing match_sanctions function...');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('match_sanctions', { query_name: 'hamas' });

    if (functionError) {
      console.error('❌ match_sanctions function failed:');
      console.error('Error Code:', functionError.code);
      console.error('Error Message:', functionError.message);
      console.error('Error Details:', JSON.stringify(functionError, null, 2));
      console.log('\n⚠️  SOLUTION: Run the SQL script in Supabase to create the function!');
      console.log('   See artifact: "match_sanctions Function for Your Existing Table"\n');
      return;
    }

    console.log(`✅ Function works! Found ${functionTest.length} matches`);
    if (functionTest.length > 0) {
      console.log('\nTop match:');
      console.log('  Name:', functionTest[0].entity_name);
      console.log('  Source:', functionTest[0].list_source);
      console.log('  Similarity:', (functionTest[0].similarity * 100).toFixed(1) + '%');
    }

    // TEST 3: Check transformerService
    console.log('\n3️⃣ Testing HuggingFace transformerService...');
    try {
      const transformerService = require('../services/transformerService');
      console.log('✅ transformerService loaded');
      
      // Try semantic similarity
      try {
        const semanticTest = await transformerService.semanticSimilarity('hamas', 'HAMAS');
        console.log('✅ Semantic similarity works:', semanticTest);
      } catch (semanticError) {
        console.warn('⚠️  Semantic similarity failed:', semanticError.message);
        console.log('   (This is optional, screening will still work)');
      }
    } catch (err) {
      console.warn('⚠️  transformerService not available:', err.message);
      console.log('   (Screening will work without semantic analysis)');
    }

    // TEST 4: Check Gemini AI
    console.log('\n4️⃣ Testing Gemini AI...');
    try {
      const { ai, model } = require('../config/geminiClient');
      console.log('✅ Gemini client loaded');
      
      // Quick test
      const testPrompt = 'Respond with just "OK" if you can see this.';
      const response = await ai.models.generateContent({
        model: model,
        contents: testPrompt
      });
      console.log('✅ Gemini AI responding:', response.text().trim());
    } catch (geminiError) {
      console.warn('⚠️  Gemini AI not available:', geminiError.message);
      console.log('   (Screening will work with fallback analysis)');
    }

    // TEST 5: Full screening test
    console.log('\n5️⃣ Testing Full Screening Function...');
    const { screenName } = require('../services/screeningService');
    
    console.log('Running: screenName("hamas")...\n');
    const result = await screenName('hamas');
    
    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('\n❌ Screening failed!');
    } else if (result.matches && result.matches.length === 0 && !result.bestMatch) {
      console.log('\n✅ No matches found (clean result)');
    } else {
      console.log('\n🎉 SUCCESS! Screening working properly!');
    }

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n' + '='.repeat(60));
}

debugScreening();
