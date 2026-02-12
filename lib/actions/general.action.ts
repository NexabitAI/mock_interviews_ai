"use server";

import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ---------------------- CREATE FEEDBACK ---------------------- */

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    if (!interviewId || !userId) {
      throw new Error("Missing interviewId or userId");
    }

    if (!transcript || transcript.length === 0) {
      throw new Error("Transcript is empty");
    }

    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}`
      )
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a professional interviewer. Return ONLY valid JSON. No markdown. No explanations.",
        },
        {
          role: "user",
          content: `
Analyze the following mock interview transcript and generate structured feedback.

Transcript:
${formattedTranscript}

Return JSON ONLY in this format:
{
  "totalScore": number,
  "categoryScores": {
    "communicationSkills": number,
    "technicalKnowledge": number,
    "problemSolving": number,
    "culturalFit": number,
    "confidenceClarity": number
  },
  "strengths": string[],
  "areasForImprovement": string[],
  "finalAssessment": string
}
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

    const parsed = feedbackSchema.parse(JSON.parse(cleaned));

    const feedback = {
      interviewId,
      userId,
      totalScore: parsed.totalScore,
      categoryScores: parsed.categoryScores,
      strengths: parsed.strengths,
      areasForImprovement: parsed.areasForImprovement,
      finalAssessment: parsed.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set(feedback);

    // ✅ Mark interview finalized
    await db.collection("interviews").doc(interviewId).update({
      finalized: true,
    });

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error: any) {
    console.error("CREATE FEEDBACK ERROR:", error.message);
    return { success: false };
  }
}

/* ---------------------- INTERVIEW READ HELPERS ---------------------- */

export async function getInterviewById(id: string) {
  if (!id) return null;

  const interview = await db.collection("interviews").doc(id).get();
  return interview.data() ?? null;
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[]> {
  if (!userId) return [];

  const snapshot = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Omit<Interview, "id">;
    return {
      id: doc.id,
      ...data,
    };
  });
}

export async function getLatestInterviews({
  userId,
  limit = 20,
}: GetLatestInterviewsParams): Promise<Interview[]> {
  if (!userId) return [];

  const snapshot = await db
    .collection("interviews")
    .where("finalized", "==", true)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const filtered = snapshot.docs.filter(
    (doc) => doc.data().userId !== userId
  );

  return filtered.map((doc) => {
    const data = doc.data() as Omit<Interview, "id">;
    return {
      id: doc.id,
      ...data,
    };
  });
}

export async function getFeedbackByInterviewId({
  interviewId,
  userId,
}: GetFeedbackByInterviewIdParams): Promise<Feedback | null> {
  if (!interviewId || !userId) return null;

  const snapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];

  return {
    id: doc.id,
    ...(doc.data() as Omit<Feedback, "id">),
  };
}

