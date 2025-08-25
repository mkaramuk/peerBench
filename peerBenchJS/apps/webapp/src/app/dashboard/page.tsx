import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const fetchCache = "force-no-store";

export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-black dark:text-white">
          Welcome to Your Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Review Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                Review and practice with peer-reviewed prompts to improve your
                skills and prepare for your tests.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/review">Start Reviewing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benchmark</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                Compare different AI models&apos; performance on your prompts
                and analyze their responses.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/benchmark">Run Benchmark</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload Prompts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                Upload your prompts for quality peer review and contribute to
                the community.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/upload">Upload Data</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                View and manage your uploaded prompt sets, track their usage,
                and monitor feedback from the peers.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/data">View Data</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                View detailed analytics about your prompts, peer reviews, and
                benchmark results.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/analytics">View Analytics</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                Configure your preferences, manage your account settings, and
                customize your experience.
              </p>
              <div className="w-full justify-center flex">
                <Button asChild variant="default" size="default">
                  <Link href="/settings">Manage Settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
