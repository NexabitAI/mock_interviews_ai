"use server";

import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { getCurrentUser } from "@/lib/actions/auth.action";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ============================================================
   CREATE FEEDBACK
============================================================ */

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, transcript, feedbackId } = params;

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      throw new Error("User not authenticated");
    }

    if (!interviewId) {
      throw new Error("Missing interviewId");
    }

    if (!transcript || transcript.length === 0) {
      throw new Error("Transcript is empty");
    }

    const userId = currentUser.id;

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
Analyze this mock interview transcript:

${formattedTranscript}

Return JSON ONLY in EXACTLY this format:

{
  "totalScore": number,
  "categoryScores": [
    { "name": "Communication Skills", "score": number, "comment": string },
    { "name": "Technical Knowledge", "score": number, "comment": string },
    { "name": "Problem Solving", "score": number, "comment": string },
    { "name": "Cultural Fit", "score": number, "comment": string },
    { "name": "Confidence and Clarity", "score": number, "comment": string }
  ],
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

    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const json = JSON.parse(cleaned);

    const parsed = feedbackSchema.parse(json);

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

    /* ============================================================
       🔥 CRITICAL FIX
       Ensure interview document exists and update safely
    ============================================================ */

    const interviewRef = db.collection("interviews").doc(interviewId);
    const interviewSnap = await interviewRef.get();

    if (!interviewSnap.exists) {
      // Prevent broken state
      await interviewRef.set({
        userId,
        finalized: true,
        createdAt: new Date().toISOString(),
      });
    } else {
      await interviewRef.update({
        finalized: true,
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error: any) {
    console.error("CREATE FEEDBACK ERROR:", error?.message || error);
    return { success: false };
  }
}

/* ============================================================
   INTERVIEW READ HELPERS
============================================================ */

export async function getInterviewById(
  id: string
): Promise<Interview | null> {
  if (!id) return null;

  const doc = await db.collection("interviews").doc(id).get();
  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...(doc.data() as Omit<Interview, "id">),
  };
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[]> {
  if (!userId) return [];

  const snapshot = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .get();

  const interviews = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Interview, "id">),
  }));

  // Safe sorting
  return interviews.sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export async function getLatestInterviews({
  userId,
  limit = 20,
}: GetLatestInterviewsParams): Promise<Interview[]> {
  if (!userId) return [];

  const snapshot = await db
    .collection("interviews")
    .where("finalized", "==", true)
    .get();

  const interviews = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Interview, "id">),
    }))
    .filter((interview) => interview.userId !== userId)
    .sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    )
    .slice(0, limit);

  return interviews;
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