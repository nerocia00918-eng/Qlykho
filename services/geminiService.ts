import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeSheetData = async (csvData: string, query: string) => {
    const ai = getAIClient();
    
    const prompt = `
    You are an expert data analyst embedded in a spreadsheet application.
    Here is the current spreadsheet data in CSV format:
    
    \`\`\`csv
    ${csvData}
    \`\`\`
    
    User Query: ${query}
    
    Please answer the user's question based on the data provided. 
    If the user asks for a formula, provide the standard Excel-style formula.
    Be concise and helpful.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: "You are a helpful spreadsheet assistant. You analyze CSV data and provide insights or formulas.",
        }
    });

    return response.text;
};

export const generateFormulasForTask = async (taskDescription: string, headers: string[]) => {
    const ai = getAIClient();
    
    const prompt = `I have a spreadsheet with these headers: ${headers.join(', ')}.
    The user wants to: ${taskDescription}.
    
    Return a JSON object with a 'formula' field containing an Excel formula that might solve this, 
    and an 'explanation' field.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    formula: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                }
            }
        }
    });

    return response.text;
};
