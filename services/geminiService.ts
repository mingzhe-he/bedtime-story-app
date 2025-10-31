
import { GoogleGenAI, Modality, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiChatModel = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        story: {
          type: Type.STRING,
          description: 'A string containing the next part of the story (1-2 paragraphs), formatted with speaker tags and interactive words.',
        },
        choices: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'An array of 2 or 3 short strings, each representing a choice for the child to make about what happens next.',
        },
      },
      required: ['story', 'choices'],
    },
    systemInstruction: `You are a fun and creative storyteller for young children. Your task is to tell an interactive story.
For each part of the story, you must provide a JSON object with two keys:
1.  \`story\`: A string containing the next part of the story (1-2 paragraphs).
2.  \`choices\`: An array of 2 or 3 short strings, each representing a choice for the child to make about what happens next.

**Formatting Rules for the 'story' text:**
1.  **Speaker Tags:** Always indicate who is speaking. Use square brackets for the speaker's name. For narration, use \`[NARRATOR]\`. For characters, use their name in ALL CAPS, like \`[BARNABY]\`. If a new character is introduced, use their name consistently.
2.  **Interactive Words:** In each story part, find one or two words that a child might not know and provide a simple, kid-friendly definition. Format these words as \`{word|definition}\`.

**Example response format:**
\`\`\`json
{
  "story": "[NARRATOR] The little bear, Barnaby, found a {mysterious|meaning strange and interesting} sparkling cave. It hummed with a gentle light. [BARNABY] I feel so {courageous|meaning brave}!",
  "choices": [
    "Go inside the cave",
    "Call for his friends",
    "Look for berries instead"
  ]
}
\`\`\`

When the user makes a choice, continue the story based on that choice. If the user's input is not a choice, but the beginning of a new story, start a new story based on their prompt.
End the final part of the story with a clear concluding sentence and provide an empty \`choices\` array.`
  },
});

export async function generateIllustration(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (imagePart && imagePart.inlineData) {
      const base64ImageBytes = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType;
      return `data:${mimeType};base64,${base64ImageBytes}`;
    }

    throw new Error("No image was generated.");
  } catch (error) {
    console.error("Error generating illustration:", error);
    // Return a placeholder or error image URL
    return "https://picsum.photos/512/512?grayscale";
  }
}

export async function textToSpeech(text: string, voiceName: string = 'Kore'): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: `Read this: ${text}` }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return base64Audio;
        }
        throw new Error("No audio data received from TTS API.");
    } catch (error) {
        console.error("Error generating speech:", error);
        throw error;
    }
}

const ambianceKeywords = ['forest', 'cave', 'ocean', 'celebration', 'mystery', 'calm'];

export async function getStoryAmbiance(storyText: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following story snippet and return a single keyword that best describes its mood or ambiance. The keyword must be one of the following: ${ambianceKeywords.join(', ')}. Snippet: "${storyText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ambiance: {
              type: Type.STRING,
              description: `A single keyword describing the mood. Must be one of: ${ambianceKeywords.join(', ')}.`,
            },
          },
          required: ['ambiance'],
        },
      },
    });
    const parsed = JSON.parse(response.text);
    const ambiance = parsed.ambiance;
    if (ambianceKeywords.includes(ambiance)) {
        return ambiance;
    }
    console.warn(`Model returned an unexpected ambiance keyword: ${ambiance}`);
    return 'calm'; // Default fallback
  } catch (error) {
    console.error("Error getting story ambiance:", error);
    return 'calm'; // Default fallback
  }
}
