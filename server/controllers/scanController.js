const supabase = require('../config/supabaseClient');

let ai, model;
try {
  const geminiClient = require('../config/geminiClient');
  ai = geminiClient.ai;
  model = geminiClient.model;
} catch (err) {
  console.warn('Gemini AI not configured');
}

exports.scanName = async (req, res) => {
  const { name, type, nationality, use_ai } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const { data: matches, error } = await supabase
      .rpc('match_sanctions', { query_name: name });

    if (error) throw error;

    if (!matches || matches.length === 0) {
      return res.json({
        name, match_found: false, matches: [],
        risk_level: 'low', timestamp: new Date().toISOString()
      });
    }

    const transformed = matches.slice(0, 10).map(m => ({
      name: m.name || 'Unknown',
      list_type: m.list_source || 'Unknown',
      confidence: m.similarity_score || 0.8,
      details: m.remarks || '',
      program: m.program || 'N/A',
      nationalities: Array.isArray(m.nationalities) ? m.nationalities.join(', ') : 'Not specified',
      aliases: Array.isArray(m.aliases) ? m.aliases.join(', ') : 'None',
      date_of_birth: m.date_of_birth || 'Unknown',
      place_of_birth: m.place_of_birth || 'Unknown',
      jurisdiction: m.jurisdiction || 'N/A',
      remarks: m.remarks || '',
      is_pep: m.entity_type === 'individual'
    }));

    const score = matches[0].similarity_score;
    const risk = score >= 0.9 ? 'critical' : score >= 0.8 ? 'high' : score >= 0.6 ? 'medium' : 'low';

    res.json({
      name, match_found: true, matches: transformed,
      risk_level: risk, timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Screening failed', details: err.message });
  }
};
