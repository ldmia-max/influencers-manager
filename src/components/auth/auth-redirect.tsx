import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

interface AuthRedirectProps {
  to: string;
  whenAuthenticated?: boolean;
}

export async function AuthRedirect({ to, whenAuthenticated = true }: AuthRedirectProps) {
  await connection();
  const session = await auth();

  if (whenAuthenticated && session?.user) {
    redirect(to);
  }

  if (!whenAuthenticated && !session?.user) {
    redirect(to);
  }

  return null;
}
