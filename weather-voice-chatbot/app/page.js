'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sun, Wind, Droplets, Thermometer, MapPin, Search, Volume2, VolumeX, RefreshCw, Loader } from 'lucide-react';

// --- Helper Components ---
const WeatherIcon = ({ iconCode, description }) => {
  if (!iconCode) return <Sun size={64} className="text-yellow-400 drop-shadow-lg" />;
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-orange-500/30 rounded-full blur-xl scale-150 animate-pulse"></div>
      <img
        src={`https://openweathermap.org/img/wn/${iconCode}@4x.png`}
        alt={description}
        className="w-32 h-32 -mt-4 -mb-4 relative z-10 drop-shadow-2xl"
      />
    </div>
  );
};

const WeatherDetail = ({ icon: Icon, value, label }) => (
  <div className="flex items-center gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 hover:bg-white/30 transition-all duration-300 hover:scale-105 hover:shadow-lg">
    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
      <Icon size={18} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-600 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center gap-4 mt-8">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
      <div className="absolute inset-0 w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600 animate-reverse"></div>
    </div>
    <p className="text-gray-600 font-medium animate-pulse">Fetching weather data...</p>
  </div>
);

// --- Main Component ---
export default function Home() {
  const [weatherData, setWeatherData] = useState({ metric: null, imperial: null });
  const [summary, setSummary] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [units, setUnits] = useState('metric');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const unitSymbols = useMemo(() => ({
    metric: { temp: '°C', speed: 'm/s' },
    imperial: { temp: '°F', speed: 'mph' },
  }), []);

  const speak = useCallback((message) => {
    if (!message || typeof window.speechSynthesis === 'undefined' || !voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    if (typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
  }, []);

  const fetchAndProcessWeather = useCallback(async (baseUrl) => {
    setLoading(true);
    setError(null);
    setWeatherData({ metric: null, imperial: null });
    setSummary('');

    try {
      // Fetch both metric and imperial data simultaneously
      const [metricRes, imperialRes] = await Promise.all([
        fetch(`${baseUrl}&units=metric`),
        fetch(`${baseUrl}&units=imperial`)
      ]);

      if (!metricRes.ok || !imperialRes.ok) {
        const errorData = await (metricRes.ok ? imperialRes : metricRes).json();
        throw new Error(errorData.error || 'An unknown API error occurred.');
      }
      
      const [metricData, imperialData] = await Promise.all([
        metricRes.json(),
        imperialRes.json()
      ]);

      setWeatherData({ metric: metricData, imperial: imperialData });

      // Generate summary using the current unit preference
      const currentData = units === 'metric' ? metricData : imperialData;
      const summaryRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weatherData: currentData }),
      });

      if (!summaryRes.ok) {
        setSummary('Could not generate a weather summary.');
        return;
      };

      const { summary } = await summaryRes.json();
      setSummary(summary);
      if (voiceEnabled) {
        speak(summary);
      }

    } catch (err) {
      setError(err.message);
      setWeatherData({ metric: null, imperial: null });
      setSummary('');
    } finally {
      setLoading(false);
    }
  }, [speak, units]);

  const handleGeolocationWeather = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        fetchAndProcessWeather(`/api/weather?lat=${lat}&lon=${lon}`);
      },
      () => {
        setError('Unable to retrieve your location. Please enable location services.');
      }
    );
  };
  
  const handleSearchWeather = (e) => {
    if (e) e.preventDefault();
    if (!query) {
      setError('Please enter a city name.');
      return;
    }
    fetchAndProcessWeather(`/api/weather?city=${encodeURIComponent(query)}`);
  };

  const handleRefresh = () => {
    if (!weatherData.metric && !weatherData.imperial) return;
    
    // Use the location data from current weather to refresh
    const currentWeather = weatherData[units];
    if (currentWeather?.location) {
      if (currentWeather.location.lat && currentWeather.location.lon) {
        fetchAndProcessWeather(`/api/weather?lat=${currentWeather.location.lat}&lon=${currentWeather.location.lon}`);
      } else if (query) {
        fetchAndProcessWeather(`/api/weather?city=${encodeURIComponent(query)}`);
      }
    }
  };

  // Simple unit change - no refetching needed since we have both datasets
  const handleUnitChange = (newUnits) => {
    setUnits(newUnits);
    
    // Regenerate summary for the new unit if we have weather data
    if (weatherData[newUnits]) {
      const newWeatherData = weatherData[newUnits];
      
      // Generate new summary for the switched units
      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weatherData: newWeatherData }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.summary) {
          setSummary(data.summary);
          if (voiceEnabled) {
            speak(data.summary);
          }
        }
      })
      .catch(() => {
        setSummary('Could not generate a weather summary.');
      });
    }
  };

  // Get current weather data based on selected units
  const weather = weatherData[units];

  return (
    <main className="flex flex-col items-center w-full min-h-screen p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-pink-400/20 to-yellow-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-br from-cyan-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => {
          // Use deterministic values based on index to avoid hydration mismatch
          const leftPercent = ((i * 47) % 100);
          const topPercent = ((i * 73) % 100);
          const delay = (i * 0.3) % 5;
          const duration = 3 + ((i * 0.5) % 4);
          
          return (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`
              }}
            />
          );
        })}
      </div>

      <div className="w-full max-w-md p-8 mt-10 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 relative z-10 hover:bg-white/15 transition-all duration-500">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl blur-xl -z-10"></div>
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent mb-3 drop-shadow-lg">
            Weather Voice Report
          </h1>
          <p className="text-white/80 font-medium">Get a spoken weather summary for any location.</p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto mt-3"></div>
          
          {/* Voice Toggle */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="text-white/70 text-sm font-medium">Voice</span>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer ${
                voiceEnabled 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-lg shadow-green-500/30' 
                  : 'bg-white/20 backdrop-blur-sm border border-white/30'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                voiceEnabled ? 'left-6' : 'left-0.5'
              }`} />
            </button>
            <div className="flex items-center gap-1">
              {voiceEnabled ? (
                <Volume2 size={16} className="text-green-400" />
              ) : (
                <VolumeX size={16} className="text-white/50" />
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-grow relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchWeather(e)}
              placeholder="E.g., London, Tokyo"
              className="w-full p-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-white placeholder-white/60 font-medium transition-all duration-300 hover:bg-white/25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-lg -z-10 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
          </div>
          <button 
            onClick={handleSearchWeather} 
            className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 cursor-pointer disabled:cursor-not-allowed"
            disabled={loading}
          >
            <Search size={24} />
          </button>
        </div>

        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={handleGeolocationWeather} 
            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white font-medium hover:bg-white/30 disabled:text-white/50 transition-all duration-300 hover:scale-105 cursor-pointer disabled:cursor-not-allowed border border-white/30"
            disabled={loading}
          >
            <MapPin size={16} /> Use My Location
          </button>
          
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-1 border border-white/30">
            <button 
              onClick={() => handleUnitChange('metric')} 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 cursor-pointer ${
                units === 'metric' 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              °C
            </button>
            <button 
              onClick={() => handleUnitChange('imperial')} 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 cursor-pointer ${
                units === 'imperial' 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              °F
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner />}
        
        {error && (
          <div className="mt-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-2xl text-white text-center animate-shake">
            <p className="font-medium">{error}</p>
          </div>
        )}
        
        {weather && !loading && (
          <div className="mt-6 p-6 bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 animate-fade-in">
            <div className="flex flex-col items-center text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">{weather.location.name}</h2>
              <div className="flex items-center justify-center mb-2">
                <WeatherIcon iconCode={weather.current.icon} description={weather.current.main} />
                <div className="ml-4">
                  <p className="text-6xl font-black text-white drop-shadow-2xl">
                    {Math.round(weather.current.temp)}
                    <span className="text-3xl align-top text-white/80">{unitSymbols[units].temp}</span>
                  </p>
                </div>
              </div>
              <p className="text-xl capitalize text-white/90 font-medium">{weather.current.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <WeatherDetail icon={Thermometer} label="Feels Like" value={`${Math.round(weather.current.feels_like)}${unitSymbols[units].temp}`} />
              <WeatherDetail icon={Droplets} label="Humidity" value={`${weather.current.humidity}%`} />
              <WeatherDetail icon={Wind} label="Wind Speed" value={`${weather.current.wind_speed} ${unitSymbols[units].speed}`} />
              <WeatherDetail icon={Sun} label="UV Index" value={weather.current.uvi} />
            </div>

            {summary && (
              <div className="border-t border-white/30 pt-6">
                <h3 className="font-bold text-white mb-3 text-lg">AI Summary:</h3>
                <blockquote className="text-white/90 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border-l-4 border-purple-500 italic font-medium mb-4">
                  {summary}
                </blockquote>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    onClick={() => speak(summary)} 
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/80 backdrop-blur-sm rounded-xl text-white font-medium hover:bg-green-600/80 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg"
                    disabled={!voiceEnabled}
                  >
                    <Volume2 size={16} /> Replay
                  </button>
                  <button 
                    onClick={stopSpeaking} 
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/80 backdrop-blur-sm rounded-xl text-white font-medium hover:bg-red-600/80 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg"
                  >
                    <VolumeX size={16} /> Stop
                  </button>
                  <button 
                    onClick={handleRefresh} 
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/80 backdrop-blur-sm rounded-xl text-white font-medium hover:bg-blue-600/80 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg ml-auto"
                  >
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0) rotate(0deg);
            opacity: 0.5;
          }
          50% { 
            transform: translateY(-20px) rotate(180deg);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-reverse {
          animation-direction: reverse;
        }
      `}</style>
    </main>
  );
}