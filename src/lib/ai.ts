import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the AI model with the API key
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function generateSubtasks(mainTask: string, numSubtasks: number): Promise<string[]> {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-8b",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    // Generate the response
    const result = await model.generateContent(
      `Task: "${mainTask}"
Instructions: Break this task into ${numSubtasks} ordered steps, starting with step 1 and ending with step ${numSubtasks}.
Rules:
1. Steps must be in logical chronological order
2. Each step must start with the step number followed by a period and space (e.g. "1. First step")
3. Steps must be sequential and dependent on previous steps
4. Return only a JSON array of strings

Example format for 3 steps:
["1. First step that needs to be done", "2. Second step after the first", "3. Final step to complete the task"]`
    );
    const response = result.response;
    const text = response.text().trim();

    try {
      // Try to parse the response as JSON
      const subtasks = JSON.parse(text);
      
      // Validate the response
      if (!Array.isArray(subtasks)) {
        throw new Error('Response is not an array');
      }

      if (subtasks.length !== numSubtasks) {
        throw new Error(`Expected ${numSubtasks} subtasks but got ${subtasks.length}`);
      }

      if (!subtasks.every(task => typeof task === 'string')) {
        throw new Error('All subtasks must be strings');
      }

      return subtasks;
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not find JSON array in response');
      }

      const subtasks = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(subtasks) || subtasks.length !== numSubtasks) {
        throw new Error(`Expected ${numSubtasks} subtasks but got ${subtasks.length}`);
      }

      if (!subtasks.every(task => typeof task === 'string')) {
        throw new Error('All subtasks must be strings');
      }

      return subtasks;
    }
  } catch (error) {
    console.error('Error generating subtasks:', error);
    
    // Check for API key issues
    if (!import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY === 'your_api_key_here') {
      throw new Error('Gemini API key not configured. Please add your API key to the .env file.');
    }
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('404') && error.message.includes('models/')) {
        throw new Error('Invalid Gemini model configuration. Please check the model name and API version.');
      }
      if (error.message.includes('500')) {
        throw new Error('Gemini API server error. Please try again later or check your API key configuration.');
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Invalid or unauthorized API key. Please check your API key configuration.');
      }
      throw new Error(error.message);
    }
    
    throw new Error('Failed to generate subtasks. Please try again later.');
  }
}
