// app/api/weather/route.js
import { NextResponse } from 'next/server';

/**
 * A helper function to process and clean the raw data from the One Call API.
 * This makes the data much easier to work with on the frontend.
 * @param {object} data - The raw data from OpenWeatherMap API.
 * @returns {object} - A structured and cleaned weather data object.
 */
const processWeatherData = (data, locationName) => {
  // Helper to convert Unix timestamp to ISO 8601 string
  const toISO = (timestamp) => new Date(timestamp * 1000).toISOString();

  return {
    location: {
      name: locationName || 'Current Location',
      lat: data.lat,
      lon: data.lon,
    },
    current: {
      timestamp: toISO(data.current.dt),
      temp: data.current.temp,
      feels_like: data.current.feels_like,
      humidity: data.current.humidity,
      uvi: data.current.uvi,
      wind_speed: data.current.wind_speed,
      sunrise: toISO(data.current.sunrise),
      sunset: toISO(data.current.sunset),
      condition: data.current.weather[0].main,
      description: data.current.weather[0].description,
      icon: data.current.weather[0].icon,
    },
    hourly: data.hourly.slice(0, 24).map(hour => ({
      timestamp: toISO(hour.dt),
      temp: hour.temp,
      condition: hour.weather[0].main,
      icon: hour.weather[0].icon,
      pop: hour.pop, 
    })),
    daily: data.daily.map(day => ({
      timestamp: toISO(day.dt),
      sunrise: toISO(day.sunrise),
      sunset: toISO(day.sunset),
      summary: day.summary,
      temp: {
        min: day.temp.min,
        max: day.temp.max,
        day: day.temp.day,
        night: day.temp.night,
      },
      humidity: day.humidity,
      wind_speed: day.wind_speed,
      condition: day.weather[0].main,
      description: day.weather[0].description,
      icon: day.weather[0].icon,
      pop: day.pop, 
    })),
    alerts: data.alerts || [],
  };
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  let lat = searchParams.get('lat');
  let lon = searchParams.get('lon');
  const city = searchParams.get('city');
  const units = searchParams.get('units') || 'metric'; // Default to metric
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is missing' }, { status: 500 });
  }

  try {
    // --- Step 1: Get coordinates. If a city is provided, use Geocoding API first. ---
    let locationName = '';

    if (city) {
      const geoResponse = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`);
      const geoData = await geoResponse.json();
      
      if (!geoResponse.ok || geoData.length === 0) {
        return NextResponse.json({ error: 'City not found' }, { status: 404 });
      }
      
      lat = geoData[0].lat;
      lon = geoData[0].lon;
      locationName = `${geoData[0].name}, ${geoData[0].country}`;
    }

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing location data. Provide lat/lon or a city.' }, { status: 400 });
    }

    // --- Step 2: Use coordinates to get detailed weather from the One Call API. ---
    const apiUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&exclude=minutely&appid=${apiKey}`;
    const weatherResponse = await fetch(apiUrl, {
      next: { revalidate: 300 } // Revalidate cache every 5 minutes (300 seconds)
    });

    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      // Forward the error message from the weather API
      return NextResponse.json({ error: weatherData.message || 'Failed to fetch weather data' }, { status: weatherResponse.status });
    }

    // --- Step 3: Process the data into a clean, structured format ---
    const processedData = processWeatherData(weatherData, locationName);

    return NextResponse.json(processedData);

  } catch (err) {
    console.error('API Route Error:', err);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}