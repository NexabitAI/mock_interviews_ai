import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { getCurrentUser } from "@/lib/actions/auth.action";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { type, role, level, techstack, amount } =
      await request.json();

    // 🔐 Get user from session cookie
    const user = await getCurrentUser();

    if (!user?.id) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 🧠 Generate interview questions
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You generate interview questions. Return ONLY a valid JSON array of strings. No markdown. No explanation.",
        },
        {
          role: "user",
          content: `
Prepare questions for a job interview.

Role: ${role}
Experience Level: ${level}
Tech Stack: ${techstack}
Focus: ${type}
Number of questions: ${amount}

Rules:
- Return ONLY a JSON array
- Do not include extra text
- Do not use special characters like / or *
- Format example:
["Question 1", "Question 2"]
`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw) throw new Error("Empty OpenAI response");

    // Clean markdown if model wraps output
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const questions = JSON.parse(cleaned);

    // 🧱 Create interview document
    const interview = {
      role,
      type,
      level,
      techstack: techstack
        .split(",")
        .map((t: string) => t.trim()),
      questions,
      userId,
      finalized: false, // 🔥 IMPORTANT FIX
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("INTERVIEW GENERATE ERROR:", error.message);

    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    { success: true, message: "Interview API is working" },
    { status: 200 }
  );
}
