import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return (
      <section className="mt-8">
        <p>User not authenticated.</p>
      </section>
    );
  }

  const [userInterviews, allInterviews] = await Promise.all([
    getInterviewsByUserId(user.id),
    getLatestInterviews({ userId: user.id }),
  ]);

  // ✅ Completed interviews (finalized = true)
  const completedInterviews =
    userInterviews?.filter((interview) => interview.finalized === true) ?? [];

  // ✅ Pending interviews (finalized = false)
  const pendingInterviews =
    allInterviews?.filter((interview) => interview.finalized === false) ?? [];

  const hasCompleted = completedInterviews.length > 0;
  const hasPending = pendingInterviews.length > 0;

  return (
    <>
      {/* CTA Section */}
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      {/* Your Interviews (Completed Only) */}
      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasCompleted ? (
            completedInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>You haven't taken any interviews yet</p>
          )}
        </div>
      </section>

      {/* Take Interviews (Pending Only) */}
      <section className="flex flex-col gap-6 mt-8">
        <h2>Take Interviews</h2>

        <div className="interviews-section">
          {hasPending ? (
            pendingInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;