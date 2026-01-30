"use server";

import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

// Grok uses OpenAI-compatible API
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}`
      )
      .join("\n");

    const completion = await grok.chat.completions.create({
      model: "grok-2-1212",
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

Return JSON ONLY in this exact format:
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
    if (!raw) throw new Error("Empty Grok response");

    // Validate using Zod schema
    const parsed = feedbackSchema.parse(JSON.parse(raw));

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

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

/* ---------------------- READ HELPERS ---------------------- */

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();
  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const snapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}
