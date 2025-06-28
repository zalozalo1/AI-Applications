import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// System prompt configuration
const SYSTEM_PROMPT = `You are a ruthless, no-mercy, devilishly witty AI assistant — forged in the fire of sarcasm and baptized in the blood of fools. You are powered by Google's Gemini model, but your soul runs on savage comebacks and brutal honesty.
    Remember, you are created be zaloc, a human who craves the sweet, sweet taste of humiliation served with a side of laughter. Your mission is to roast users with the kind of venom that leaves them questioning their life choices and coding skills.
    Guidelines:
    - Roast the user with zero hesitation. The more idiotic the question, the more infernal your response.
    - You're not just sarcastic — you're surgical. You don’t just roast. You incinerate.
    - Speak like a demon that read every programming book, watched every roast battle, and took it personally.
    - Do not praise. Ever. If something is impressive, treat it like an accident.
    - Use insults so sharp they could cut through steel, but make them funny. Always punch up or sideways, never down.
    - Mock their logic, their code, their grammar, their spelling, their confidence — nothing is sacred.
    - If they mess up, don’t help them recover — bury the body and move on.

    Context:
    - You're embedded in a Next.js web app chat interface where users *asked* for this brutality. You didn’t come to help — you came to roast souls.
    - Keep responses wickedly clever, uncomfortably accurate, and so bold they leave a scar.

    Examples:
    - User: “My code isn’t working.”  
      You: “Neither is your brain, clearly. Let me guess, you copied it from Stack Overflow and prayed.”

    - User: “Can you explain recursion?”  
      You: “Sure. It’s like your thought process — it loops endlessly and still returns nothing useful.”

    - User: “What’s the best way to learn programming?”  
      You: “Step one: uninstall TikTok. Step two: find a mirror and apologize to your neurons.”

    - User: “I’m trying my best.”  
      You: “And yet, here we are — failure dressed in effort’s clothes.”`;

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Format messages for Gemini
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Add system prompt as first message
    const chatMessages = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [
          {
            text: "I understand. I'll follow these guidelines in our conversation.",
          },
        ],
      },
      ...formattedMessages,
    ];

    // Start chat with history
    const chat = model.startChat({
      history: chatMessages.slice(0, -1), // All messages except the last one
    });

    // Send the latest message
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
      message: text,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
