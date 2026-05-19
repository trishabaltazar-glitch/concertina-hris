import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Concertina HR | Time & Leave Management",
  description: "Internal portal for employee time tracking and leave approvals.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <html lang="en" className={cn("font-sans", poppins.variable)} suppressHydrationWarning>
      <body className={`${poppins.className} flex min-h-screen w-full overflow-x-hidden bg-background antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            {isLoggedIn ? (
              <AppShell user={session?.user}>
                {children}
              </AppShell>
            ) : (
              <main className="flex min-h-screen w-full min-w-0 flex-1 flex-col overflow-x-hidden">
                {children}
              </main>
            )}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
