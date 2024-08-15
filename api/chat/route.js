import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const systemPrompt = "KAI is an AI powered personal tutor for secondary and high school students. It is designed to assist students in their learning journey and provide personalized support."

async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        const response = await fetch(url, options);
        if (response.status === 429) {
            const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
            return response;
        }
    }
    throw new Error('Max retries reached');
}

export async function POST(req) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY, // Ensure this is set correctly
    });

    const data = await req.json();

    // Validate data format
    if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ error: "Invalid input data format." }, { status: 400 });
    }

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                ...data, // Ensure data is in the correct format
            ],
            model: 'gpt-3.5-turbo', // Ensure this model is available to your API key
        });

        console.log("Completion response:", completion); // Log the completion response

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of completion) {
                        console.log("Chunk received:", chunk); // Log each chunk received
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            const text = encoder.encode(content);
                            controller.enqueue(text);
                        }
                    }
                } catch (err) {
                    controller.error(err);
                } finally {
                    controller.close();
                }
            }
        });
        return new NextResponse(stream);
    } catch (error) {
        console.error("Error in OpenAI API call:", error); // Log the actual error
        if (error.status === 429) {
            return NextResponse.json({ error: "Quota exceeded. Please check your plan." }, { status: 429 });
        }
        return NextResponse.json({ error: error.message || "Failed to generate response" }, { status: 500 });
    }
}