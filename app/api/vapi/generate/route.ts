import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!, // ✅ correct key
  baseURL: "https://api.x.ai/v1",    // ✅ xAI endpoint
});

export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid } =
    await request.json();

  try {
    const completion = await grok.chat.completions.create({
      model: "grok-2-mini", // ✅ fast + cheap
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are a professional interviewer generating interview questions. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `
Prepare ${amount} interview questions.

Role: ${role}
Experience level: ${level}
Tech stack: ${techstack}
Focus: ${type}

Rules:
- Return ONLY valid JSON
- No markdown
- No special characters like / or *
- Output format EXACTLY like this:

["Question 1", "Question 2", "Question 3"]
`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw) {
      throw new Error("Empty AI response");
    }

    const questions: string[] = JSON.parse(raw);

    const interview = {
      role,
      type,
      level,
      techstack: techstack.split(","),
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Interview generation error:", error);
    return Response.json(
      { success: false, message: "Failed to generate interview" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
