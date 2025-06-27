// app/api/summarize/route.js
import { NextResponse } from 'next/server';

/**
 * Pre-processes the complex weather data into a simple, human-readable text block.
 * This is far more effective for the LLM than parsing raw JSON.
 * @param {object} weatherData - The processed weather data from our /api/weather route.
 * @returns {string} - A clean text context for the AI prompt.
 */
const createSummaryContext = (weatherData) => {
  const { location, current, daily, alerts } = weatherData;
  const today = daily[0];

  let context = `
- Location: ${location.name}
- Current Temperature: ${Math.round(current.temp)} degrees.
- Feels Like: ${Math.round(current.feels_like)} degrees.
- Current Conditions: ${current.description}.
- Today's High: ${Math.round(today.temp.max)} degrees.
- Today's Low: ${Math.round(today.temp.min)} degrees.
- Today's Forecast: ${today.summary}.
- Chance of Precipitation: ${Math.round(today.pop * 100)}%.
- Wind Speed: ${current.wind_speed} meters per second.
- Sunrise: ${new Date(current.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
- Sunset: ${new Date(current.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
  `;

  if (alerts && alerts.length > 0) {
    context += `\n- !!! ACTIVE WEATHER ALERTS: `;
    alerts.forEach(alert => {
      context += `[${alert.event}: ${alert.description}] `;
    });
  }

  return context.trim();
};

export async function POST(req) {
  const { weatherData } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('Gemini API key is not configured.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  if (!weatherData || !weatherData.current || !weatherData.daily) {
    return NextResponse.json({ error: 'Invalid or missing weather data provided.' }, { status: 400 });
  }

  const summaryContext = createSummaryContext(weatherData);

  const prompt = `
  -your audience is listening to a voice report, so be natural and easy to understand.

Based on the following data, provide a weather summary in a single, continuous paragraph.
- Start with the current conditions in ${weatherData.location.name}.
- start with goodmorning, good afternoon, or good evening based on the current time.
- Mention the day's expected high and low.
- Highlight the most important forecast event (like rain, snow, strong winds, or clear skies).
- If there are any weather alerts, state them clearly and urgently at the end of the summary.
- Keep the entire summary under 75 words.

Weather Data:
${summaryContext}
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            topK: 40,
            maxOutputTokens: 150,
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error('Gemini API Error:', result.error?.message || 'Unknown error');
      return NextResponse.json({ error: 'Failed to generate summary from AI service.' }, { status: 502 }); // 502 Bad Gateway
    }

    if (!result.candidates || result.candidates.length === 0) {
      console.warn('Gemini returned no candidates. Finish reason:', result.promptFeedback?.blockReason);
      return NextResponse.json({ summary: 'The weather summary could not be generated due to content restrictions.' });
    }

    const summary = result.candidates[0].content.parts[0].text
      .replace(/\*/g, '')
      .replace(/\n/g, ' ')
      .trim();

    return NextResponse.json({ summary });

  } catch (err) {
    console.error('Internal Server Error:', err);
    return NextResponse.json({ error: 'Failed to communicate with the summarization service.' }, { status: 500 });
  }
}