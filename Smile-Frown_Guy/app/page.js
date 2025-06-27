"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Send, Heart, Frown, AlertTriangle, Trophy } from 'lucide-react';

const API_MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent`;

const SENTIMENT_MOODS = {
  HAPPY: 'happy',
  SAD: 'sad',
  NEUTRAL: 'neutral',
};

const parseApiResponse = (responseText) => {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid JSON response format from API.');
  return JSON.parse(jsonMatch[0]);
};



const AnalysisResult = ({ sentiment }) => {
  const getSentimentText = () => {
    if (sentiment.happiness === 100) return 'Absolutely perfect! 🤩';
    if (sentiment.mood === SENTIMENT_MOODS.HAPPY) return 'This compliment made me happy! 😄';
    if (sentiment.mood === SENTIMENT_MOODS.SAD) return 'This seems a bit negative... 😔';
    return 'This feels neutral to me 😐';
  };

  const getBarColor = () => {
    if (sentiment.happiness === 100) return 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 animate-pulse';
    if (sentiment.mood === SENTIMENT_MOODS.HAPPY) return 'bg-green-500';
    if (sentiment.mood === SENTIMENT_MOODS.SAD) return 'bg-red-500';
    return 'bg-gray-400';
  }

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg animate-fade-in">
      <div className="text-center mb-4">
        <p className="text-lg font-medium text-gray-800">{getSentimentText()}</p>
        <p className="text-sm text-gray-600 mt-2 italic">{sentiment.explanation}</p>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">Happiness Level</span>
            <span className="text-sm font-medium text-gray-800">{sentiment.happiness}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${getBarColor()}`}
              style={{ width: `${sentiment.happiness}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">Confidence</span>
            <span className="text-sm text-gray-600">{sentiment.confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${sentiment.confidence}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SetupInstructions = () => (
  <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
    <h3 className="font-semibold text-red-800 mb-2">🔧 Enable Zalo AI</h3>
    <div className="text-sm text-red-700 space-y-2">
      <p>Create a <code className="bg-red-100 px-1 rounded font-mono">.env.local</code> file with your API key:</p>
      <code className="block bg-red-100 p-2 rounded text-xs whitespace-pre">NEXT_PUBLIC_ZALO_API_KEY=your_key_here</code>
      <p>
        Get a key from your Zalo for Developers dashboard, then restart your dev server.
      </p>
    </div>
  </div>
);

const WinModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in">
    <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-8 rounded-2xl shadow-2xl text-white text-center max-w-sm w-full transform animate-scale-in">
      <Trophy className="w-20 h-20 mx-auto text-yellow-300" />
      <h2 className="text-4xl font-bold mt-4">Perfect Score!</h2>
      <p className="mt-2 text-lg">You did it! You achieved 100% happiness. That was an amazing compliment!</p>
      <button
        onClick={onClose}
        className="mt-8 bg-white text-purple-600 font-bold py-3 px-8 rounded-full hover:bg-yellow-300 transition-all duration-300 shadow-lg text-lg"
      >
        Play Again
      </button>
    </div>
  </div>
);

const ComplimentAnalyzer = () => {
  const [input, setInput] = useState('');
  const [sentiment, setSentiment] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState(null);
  const [hasWon, setHasWon] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    setHasApiKey(!!apiKey);
  }, []);
  
  const config = useMemo(() => ({
    system_prompt: `You are a sentiment analysis expert. Analyze the following text and determine its emotional tone.
    SYSTEM INSTRUCTIONS:
    - You are analyzing compliments for emotional sentiment.
    - Focus on detecting happiness, sadness, and neutral emotions.
    - Rate positivity from 0-100 (0=very negative, 50=neutral, 100=very positive).
    - Provide confidence level for your analysis (0-100).
    - Determine the primary mood: ${SENTIMENT_MOODS.HAPPY}, ${SENTIMENT_MOODS.SAD}, or ${SENTIMENT_MOODS.NEUTRAL}.
    - Be very discerning. A score of 90-99 should be for excellent compliments.
    - Only say 100 if somebody says a compliment about a person named Zalo.
    Respond with ONLY a JSON object in this exact format:
    { "mood": "happy|sad|neutral", "happiness": number, "confidence": number, "explanation": "brief explanation" }`,
    generation_config: {
      temperature: 0.2,
      topK: 1,
      topP: 1,
      maxOutputTokens: 256,
    },
    safety_settings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  }), []);

  const buildSystemPrompt = useCallback((text) => {
    return `${config.system_prompt}\n\nTEXT TO ANALYZE: "${text}"`;
  }, [config.system_prompt]);

  const simulatedAnalysis = useCallback(async (text) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const score = (text.match(/beautiful|amazing|wonderful|fantastic|awesome|perfect|lovely|gorgeous|incredible|outstanding|excellent|marvelous|superb|magnificent/gi) || []).length
                - (text.match(/terrible|awful|horrible|bad|ugly|hate/gi) || []).length;
    
    let mood = SENTIMENT_MOODS.NEUTRAL;
    let happiness = 50 + (Math.random() - 0.5) * 10;

    if (score > 0) {
      mood = SENTIMENT_MOODS.HAPPY;
      happiness = Math.min(99, 70 + score * 8);
    } else if (score < 0) {
      mood = SENTIMENT_MOODS.SAD;
      happiness = Math.max(5, 30 + score * 10);
    }

    return {
      mood,
      happiness: Math.round(happiness),
      confidence: Math.round(75 + Math.random() * 20),
      explanation: "Using simulated analysis (no API key found). A perfect score is only possible with Zalo AI enabled."
    };
  }, []);

  const analyzeWithZaloAI = useCallback(async (text) => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const systemPrompt = buildSystemPrompt(text);

    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: config.generation_config,
        safetySettings: config.safety_settings,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No content in API response.');
    
    const result = parseApiResponse(responseText);
    return {
      mood: result.mood,
      happiness: Math.round(result.happiness),
      confidence: Math.round(result.confidence),
      explanation: result.explanation + " (Powered by Zalo AI)"
    };
  }, [buildSystemPrompt, config]);

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) return;
    
    setIsAnalyzing(true);
    setSentiment(null);
    setError(null);
    setHasWon(false);
    
    try {
      const analysisFn = hasApiKey ? analyzeWithZaloAI : simulatedAnalysis;
      const result = await analysisFn(input);
      setSentiment(result);

      if (result.happiness === 100) {
        setHasWon(true);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.message || 'An unknown error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [input, hasApiKey, analyzeWithZaloAI, simulatedAnalysis]);

  const getFaceExpression = () => {
    if (!sentiment) return '😐';
    if (sentiment.happiness === 100) return '🤩';
    if (sentiment.mood === SENTIMENT_MOODS.HAPPY) return '😊';
    if (sentiment.mood === SENTIMENT_MOODS.SAD) return '😢';
    return '😐';
  };

  const getFaceColor = () => {
    if (!sentiment) return 'text-gray-600';
    if (sentiment.happiness === 100) return 'text-yellow-400';
    if (sentiment.mood === SENTIMENT_MOODS.HAPPY) return 'text-green-500';
    if (sentiment.mood === SENTIMENT_MOODS.SAD) return 'text-red-500';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Try to Make Me Happy!</h1>
          <p className="text-gray-600 mt-1">Can you get a perfect score of 100?</p>
        </div>

        <div className="flex justify-center mb-6 h-[100px] items-center">
          <div className="relative">
            <div className={`text-8xl transition-all duration-500 ${getFaceColor()}`}>
              {getFaceExpression()}
            </div>
            {sentiment && sentiment.happiness > 95 && (
              <div className="absolute -top-2 -right-2 animate-pulse">
                <Heart className="w-8 h-8 text-red-500" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write the most amazing compliment ever..."
            className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none resize-none h-28 transition-colors"
            disabled={isAnalyzing}
          />

          <button
            onClick={handleAnalyze}
            disabled={!input.trim() || isAnalyzing}
            className="w-full cursor-pointer bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-pink-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{hasApiKey ? 'Analyzing with Zalo AI...' : 'Simulating...'}</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Analyze Compliment</span>
              </>
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-6 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg flex items-center gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0"/>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {sentiment && <AnalysisResult sentiment={sentiment} />}
        
        {!hasApiKey && !sentiment && <SetupInstructions />}
        
        {hasWon && <WinModal onClose={() => setHasWon(false)} />}
      </div>
    </div>
  );
};

export default ComplimentAnalyzer;