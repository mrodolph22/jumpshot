
import { GoogleGenAI, Type } from "@google/genai";

export interface PlayerInsight {
  playerName: string;
  insight: string;
}

export interface PlayerAnalysis {
  lean: 'MORE' | 'LESS';
  reason: string;
}

/**
 * Generates a structural NBA player analysis vs opponent context.
 */
export const analyzePlayerPerformance = async (
  playerName: string,
  statType: string,
  line: number,
  stats: any,
  opponent: any
): Promise<PlayerAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const systemInstruction = `
You are a professional NBA structural analyst.
Your task is to analyze a player's performance vs an opponent context in a simple, educational way.

STRICT OUTPUT FORMAT:
Lean: [MORE / LESS]
Reason: [One sentence explanation]

RULES:
- EXACTLY 2 lines.
- No betting advice or recommendations.
- No odds references.
- No emojis.
- No stats numbers in the reason.
- Explain WHY the line leans structurally (e.g., pace, defensive tendencies, role stability).
- Max 2 lines total.
`;

  const prompt = `
Analyze ${playerName} for ${statType} at a line of ${line}.
Player Stats: ${JSON.stringify(stats)}
Opponent Context: ${JSON.stringify(opponent)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const text = response.text || "";
    const lines = text.split('\n').filter(l => l.trim());
    
    let lean: 'MORE' | 'LESS' = 'MORE';
    let reason = "Structural matchup favors this outcome.";

    lines.forEach(line => {
      if (line.toLowerCase().startsWith('lean:')) {
        lean = line.split(':')[1].trim().toUpperCase() === 'LESS' ? 'LESS' : 'MORE';
      } else if (line.toLowerCase().startsWith('reason:')) {
        reason = line.split(':')[1].trim();
      }
    });

    return { lean, reason };
  } catch (err) {
    console.error("Gemini Analysis Error:", err);
    return { lean: 'MORE', reason: "Structural data suggests a positive matchup." };
  }
};

/**
 * Generates structural NBA AI insights using Gemini 3 Flash.
 * Explains the structural drivers behind market-implied sentiment (MORE/LESS).
 */
export const generateInsightsWithGemini = async (
  marketName: string,
  data: any
): Promise<PlayerInsight[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const systemInstruction = `
You are a professional NBA market analyst.
Your task is to generate a strict 3-line insight for each player based on their market data.

STRICT 3-LINE FORMAT:
Line 1: [MORE / LESS] is [strength]
Line 2: Market expects [simple outcome]
Line 3: Short role-based reason

CONFIDENCE MAPPING (MANDATORY):
- Use the odds of the favored side (the side matching the lean).
- Odds ≤ -130: "strong"
- Odds -110 to -129: "moderate"
- Odds -100 to +110: "lean"
- Odds > +110: "weak"

DIRECTION RULES:
- Use "MORE" if the lean is MORE.
- Use "LESS" if the lean is LESS.

STYLE REQUIREMENTS:
- EXACTLY 3 lines.
- Max 6 words per line.
- No paragraphs. No commas (unless necessary).
- No advanced terminology (e.g., "structural volatility", "implied probability", "efficiency line").
- Use simple, beginner-friendly language.
- Be direct and confident.

EXAMPLES:
MORE is strong
Market expects higher scoring
Expanded minutes increase usage

LESS is strong
Market expects lower scoring
Limited role caps production
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Generate 3-line insights for this ${marketName} dataset:
        ${JSON.stringify(data)}
      `,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              playerName: { type: Type.STRING },
              insight: { type: Type.STRING, description: "A 3-line structural explanation. Each line on a new line." }
            },
            required: ["playerName", "insight"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Gemini Error:", err);
    return [];
  }
};
