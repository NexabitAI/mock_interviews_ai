import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";

const Layout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  return (
    <div className="root-layout">
      <nav className="flex items-center justify-between py-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
          <h2 className="text-primary-100">PrepWise</h2>
        </Link>

        {/* Server-rendered logout button via POST */}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
          >
            Sign out
          </button>
        </form>
      </nav>

      {children}
    </div>
  );
};

export default Layout;
