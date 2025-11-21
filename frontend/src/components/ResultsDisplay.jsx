import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ChevronDown,
  ChevronUp,
  User,
  Building,
  FileText,
  Info,
  Calendar,
  MapPin,
  Globe,
  Hash,
  Shield,
  ShieldAlert,
  BookOpen,
  Brain
} from 'lucide-react';

const MatchDetails = ({ match, riskLevel }) => {
  if (!match) return null;

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  const formatConfidence = (confidence) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const getEntityIcon = (type) => {
    return type === 'entity' ? 
      <Building className="h-4 w-4" /> : 
      <User className="h-4 w-4" />;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {getEntityIcon(match.type)}
          <span className="font-semibold text-lg">{match.name}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className={getConfidenceColor(match.confidence)}>
            Confidence: {getConfidenceLabel(match.confidence)} ({formatConfidence(match.confidence)})
          </Badge>
          <Badge className={getRiskColor(riskLevel)}>
            {riskLevel?.toUpperCase() || 'LOW'} RISK
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">List Type:</span>
            <Badge variant="outline">{match.list_type}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Program:</span>
            <span className="text-sm">{match.program}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Nationalities:</span>
            <span className="text-sm">{match.nationalities}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium">Aliases:</span>
              <p className="text-sm mt-1">{match.aliases}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Date of Birth:</span>
            <span className="text-sm">{match.date_of_birth}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Place of Birth:</span>
            <span className="text-sm">{match.place_of_birth}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Jurisdiction:</span>
            <span className="text-sm">{match.jurisdiction}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {match.is_pep ? (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            ) : (
              <Shield className="h-4 w-4 text-gray-500" />
            )}
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={match.is_pep ? "default" : "outline"}>
              {match.is_pep ? "PEP" : "Sanctions"}
            </Badge>
          </div>
        </div>
      </div>
      
      {match.remarks && (
        <>
          <Separator />
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium">Remarks:</span>
              <p className="text-sm mt-1">{match.remarks}</p>
            </div>
          </div>
        </>
      )}
      
      <Separator />
      
      <div className="bg-gray-50 p-3 rounded-md">
        <span className="text-sm font-medium">Full Details:</span>
        <p className="text-sm mt-1 whitespace-pre-wrap">{match.details}</p>
      </div>
    </div>
  );
};

const ResultsDisplay = ({ results }) => {
  const [expandedMatch, setExpandedMatch] = useState(0);
  
  // Debug: Log the results to see what we're receiving
  console.log('ResultsDisplay received:', results);
  
  if (!results) return null;
  
  // Extract all fields including bio and ai_analysis
  const { 
    match_found, 
    matches, 
    risk_level, 
    name, 
    demo_mode, 
    bio, 
    ai_analysis,
    aiAnalysis // Also check for camelCase version
  } = results;

  // Use either version of AI analysis
  const finalAiAnalysis = ai_analysis || aiAnalysis;
  
  // Debug logs
  console.log('Bio:', bio);
  console.log('AI Analysis:', finalAiAnalysis);
  
  const getStatusIcon = () => {
    if (!match_found) return <XCircle className="h-6 w-6 text-green-500" />;
    
    switch (risk_level?.toLowerCase()) {
      case 'critical': return <AlertTriangle className="h-6 w-6 text-red-500" />;
      case 'high': return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      default: return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
  };
  
  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };
  
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  
  const formatConfidence = (confidence) => {
    return `${Math.round(confidence * 100)}%`;
  };
  
  const getEntityIcon = (type) => {
    return type === 'entity' ? 
      <Building className="h-4 w-4" /> : 
      <User className="h-4 w-4" />;
  };
  
  const toggleExpanded = (index) => {
    setExpandedMatch(expandedMatch === index ? -1 : index);
  };
  
  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-base sm:text-lg">Screening Results for: {name}</span>
            </div>
            {demo_mode && (
              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                Demo Mode
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!match_found ? (
            <div className="text-center py-6">
              <p className="text-lg font-medium text-green-600">No matches found</p>
              <p className="text-sm text-gray-500 mt-1">The individual/entity is not on any sanctions list</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getRiskColor(risk_level)}>
                  {risk_level?.toUpperCase() || 'LOW'} RISK
                </Badge>
                <span className="text-sm text-gray-500">
                  {matches?.length || 0} potential match{matches?.length !== 1 ? 'es' : ''} found
                </span>
              </div>
              
              {/* Bio Section - ENHANCED with better visibility */}
              {bio && bio.trim() && (
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <span>Background Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-800 leading-relaxed">{bio}</p>
                  </CardContent>
                </Card>
              )}

              {/* AI Analysis Section - ENHANCED with better visibility */}
              {finalAiAnalysis && finalAiAnalysis.trim() && (
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-purple-900">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <span>AI Risk Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{finalAiAnalysis}</p>
                  </CardContent>
                </Card>
              )}
              
              {/* Matches */}
              {matches && matches.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Detailed Matches:
                  </h3>
                  {matches.map((match, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden shadow-sm">
                      <div 
                        className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleExpanded(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getEntityIcon(match.type)}
                            <span className="font-medium">{match.name}</span>
                            <Badge variant="outline">{match.list_type}</Badge>
                            <Badge className={getConfidenceColor(match.confidence)}>
                              {formatConfidence(match.confidence)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {index === expandedMatch ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {index === expandedMatch && (
                        <div className="border-t">
                          <MatchDetails match={match} riskLevel={risk_level} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsDisplay;
export { MatchDetails };