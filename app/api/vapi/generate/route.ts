import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { type, role, level, techstack, amount, userId } =
      await request.json();

    if (!userId) {
      return Response.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

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
Prepare interview questions.

Role: ${role}
Experience Level: ${level}
Tech Stack: ${techstack}
Focus: ${type}
Number of questions: ${amount}

Return format example:
["Question 1", "Question 2", "Question 3"]
`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty OpenAI response");

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const questions = JSON.parse(cleaned);

    const interview = {
      role,
      type,
      level,
      techstack: techstack.split(","),
      questions,
      userId, // ✅ CORRECT FIELD NAME
      finalized: false,
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
    { success: true, message: "Interview API working" },
    { status: 200 }
  );
}
