import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force Node.js runtime and set max duration (60s is max for hobby plan)
export const runtime = 'nodejs';
export const maxDuration = 60;

// Read the system prompt from the file
const getSystemPrompt = (): string => {
  try {
    const promptPath = path.join(process.cwd(), 'monthlyrptsysprompt.txt');
    return fs.readFileSync(promptPath, 'utf8');
  } catch (error) {
    console.error('Error reading system prompt file:', error);
    return `You are tasked with creating a professional monthly business report for 10X Engineered Materials, a company that manufactures superoxalloy abrasives for industrial applications. Using the bullet points provided, transform them into a comprehensive, well-structured report that follows the company's voice and reporting style.`;
  }
};

export async function POST(req: Request) {
  console.log('1. Monthly Report API route hit');
  
  try {
    // Log environment info
    console.log('Environment:', {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      apiKeyExists: !!process.env.PERPLEXITY_API_KEY,
      apiKeyLength: process.env.PERPLEXITY_API_KEY?.length
    });

    console.log('2. Parsing request body');
    const { message } = await req.json();
    
    if (!message || typeof message !== 'string') {
      console.error('Invalid message format:', { messageType: typeof message });
      return NextResponse.json(
        { message: 'Invalid request format' },
        { status: 400 }
      );
    }

    console.log('3. Creating monthly report');
    
    // Get the system prompt
    const SYSTEM_PROMPT = getSystemPrompt();
    
    // Perplexity Implementation
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar-reasoning-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        include_citations: true,
        context_level: 5,
        include_sources: true
      })
    });

    const data = await response.json();
    console.log('4. Monthly report response received - Structure:', {
      hasResponse: !!data.choices?.[0]?.message?.content,
      contentLength: data.choices?.[0]?.message?.content?.length,
      hasContext: !!data.choices?.[0]?.message?.context,
      hasMetadata: !!data.choices?.[0]?.message?.metadata,
      hasCitations: !!data.citations,
      messageKeys: Object.keys(data.choices?.[0]?.message || {})
    });

    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from API');
    }

    // Get the citations array from the root level
    const citations = data.citations || [];
    
    return NextResponse.json(
      { 
        response: data.choices[0].message.content,
        citations: citations
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error: unknown) {
    const err = error as Error & { status?: number; response?: unknown };
    console.error('Detailed Error:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause,
      response: err.response
    });

    // Return specific error messages
    if (err.status === 401) {
      return NextResponse.json(
        { message: 'Authentication failed' },
        { status: 401 }
      );
    }
    if (err.status === 429) {
      return NextResponse.json(
        { message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { message: `Error processing request: ${err.message}` },
      { status: 500 }
    );
  }
}
