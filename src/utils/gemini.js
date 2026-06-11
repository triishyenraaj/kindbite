// src/utils/gemini.js

export async function detectFoodTags(base64Image) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Using the highly stable 2.5 Flash model
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`;

  // UPDATED PROMPT: Added Non-Food Validation and Zero-Waste Tone
  const prompt = `
    Analyze this image. You are an AI assistant for a food rescue app called KindBite.

    Step 1: Determine if the image contains edible food or beverages. 
    If the image does NOT contain food (e.g., it is a person, furniture, random object, or inappropriate), stop analyzing and return EXACTLY this JSON:
    {
      "isFood": false,
      "foodName": "",
      "primaryCategory": "",
      "additionalTags": [],
      "description": "No food detected. Please upload a clear and correct image of the food you wish to donate."
    }

    Step 2: If the image DOES contain food, analyze it and categorize it.
    List A (Primary Category - CHOOSE EXACTLY ONE):
    ["Cooked Food", "Fresh Produce", "Packaged / Canned", "Frozen Food", "Bakery", "Beverages"]

    List B (Additional Tags - CHOOSE ALL THAT APPLY, OR LEAVE EMPTY):
    ["Halal", "Vegetarian", "Vegan", "Chicken", "Meat", "Seafood", "Dairy", "Eggs", "Spicy"]

    Step 3: Write a short 1-to-2 sentence description. Describe the food appetizingly, but use a casual, peer-to-peer tone (like someone sharing extra food with a neighbor). 
    CRITICAL: Do NOT use formal, corporate charity language like "Your donation helps us..." or "making a real difference in our community." 
    Instead, use natural, direct phrasing about simply not wanting the food to go to waste. 
    Example tone: "A delicious and hearty fried rice omelette! Perfectly good food, just hoping to share it with someone hungry so it doesn't go to waste."
    Step 4: Provide a short, clear title for the food (maximum 4 to 5 words).

    Respond ONLY with a valid JSON object in this exact format. Do not add markdown or explanations:
    {
      "isFood": true,
      "foodName": "Your short title here",
      "primaryCategory": "Your choice from List A",
      "additionalTags": ["Choice 1", "Choice 2"],
      "description": "Your donation-oriented description here..."
    }
  `;

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("🚨 Google API Rejected the Request:", errorData);
      return null;
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Gemini");
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return null; 
  }
}