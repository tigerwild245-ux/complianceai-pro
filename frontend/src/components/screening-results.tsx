// src/components/screening-results.tsx
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Shield, 
  ShieldAlert,
  Download,
  ExternalLink 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ScreeningResults({ result }: { result: any }) {
  if (!result) return null;

  // 🛡️ DEFENSIVE DATA FETCHING (HOTFIX)
  // This ensures we find the bio if it exists at ANY level of the JSON response
  const displayBio = result.bio || 
                     result.best_match?.bio || 
                     (result.matches && result.matches[0]?.entity_summary) || 
                     null;

  // Use the dynamic title from backend, or fallback
  const bioTitle = result.bio_title || "Identity Profile";
  
  // Clean up the analysis text to remove 'candidate' references
  const analysisText = result.ai_analysis || result.analysis || "Analysis complete.";
  const displayAnalysis = analysisText.replace(/candidate/gi, "subject");

  // Determine Risk Styling
  const riskLevel = result.risk_level || "LOW";
  const isHighRisk = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';
  
  return (
    <div className="space-y-6 mt-8 animate-in fade-in duration-500">
      
      {/* 1. Risk Summary Banner */}
      <div className={`p-4 rounded-lg border-l-4 shadow-sm flex justify-between items-center ${
        isHighRisk ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'
      }`}>
        <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-full ${isHighRisk ? 'bg-red-100' : 'bg-green-100'}`}>
            {isHighRisk ? 
              <ShieldAlert className={`h-8 w-8 ${isHighRisk ? 'text-red-600' : 'text-green-600'}`} /> : 
              <CheckCircle className="h-8 w-8 text-green-600" />
            }
          </div>
          <div>
            <h2 className={`text-xl font-bold tracking-tight ${isHighRisk ? 'text-red-800' : 'text-green-800'}`}>
              {riskLevel} RISK LEVEL
            </h2>
            <p className="text-sm opacity-90 font-medium">
              {result.matches?.length || 0} match(es) identified requiring attention
            </p>
          </div>
        </div>
        <Button variant={isHighRisk ? "destructive" : "outline"}>
          {isHighRisk ? "REVIEW REQUIRED" : "EXPORT REPORT"}
        </Button>
      </div>

      {/* 2. AI Analysis Card (Groq/Reasoning) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <Shield className="h-5 w-5 text-purple-600" />
            {result.ai_assessment_title || "Due Diligence Analysis"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
           <p className="text-slate-700 leading-relaxed text-sm">
             {displayAnalysis}
           </p>
        </CardContent>
      </Card>

      {/* 3. IDENTITY PROFILE (THE FIX) */}
      {displayBio && (
        <Card className="border-blue-200 bg-blue-50/30 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-blue-100 bg-blue-50">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5 text-blue-600" />
              {bioTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
             <div className="text-slate-800 leading-relaxed text-sm">
               {displayBio}
             </div>
             
             <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50">
                  ✨ Gemini Verified
                </Badge>
                {result.best_match?.is_pep && (
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                    PEP Match
                  </Badge>
                )}
             </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Match Details List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Enhanced Match Details
            </h3>
        </div>
        
        {result.matches && result.matches.length > 0 ? (
          result.matches.map((m: any, i: number) => (
             <Card key={i} className="group hover:border-slate-400 transition-colors">
                <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs font-mono">
                                    MATCH #{i + 1}
                                </Badge>
                                {m.match_type && (
                                    <Badge variant="outline" className={m.match_type === 'PEP' ? 'text-red-600 border-red-200' : 'text-orange-600 border-orange-200'}>
                                        {m.match_type}
                                    </Badge>
                                )}
                            </div>
                            <h4 className="font-bold text-lg text-slate-900">{m.name || m.entity_name}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                                <span className="font-semibold text-slate-700">Program:</span> {m.program || "Global Sanctions List"}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-slate-900">{m.score}%</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Match Score</div>
                        </div>
                    </div>
                </CardContent>
             </Card>
          ))
        ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                No detailed matches available.
            </div>
        )}
      </div>

    </div>
  );
}