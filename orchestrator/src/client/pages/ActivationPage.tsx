import { activateLicense } from "@client/api";
import { KeyRound } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ActivationPage({ onActivated }: { onActivated: () => void }) {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await activateLicense({ username: username.trim(), token: token.trim() });
      onActivated();
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Activation failed",
      );
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <div className="mx-auto grid min-h-[78vh] max-w-5xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-xl">
          <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="mb-3 text-sm font-semibold tracking-wide text-primary">
            MEOW AI ACCESS
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Your workspace is ready. Unlock it once.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Enter the username and access token provided by Pranay Chimmani. All
            your job data stays local.
          </p>
        </section>

        <form
          onSubmit={submit}
          className="rounded-[28px] border border-border bg-card p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold tracking-tight">
            Activate Meow AI
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tokens are tied to the username they were issued for.
          </p>
          <div className="mt-7 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="activation-username"
                className="text-sm font-medium"
              >
                Username
              </label>
              <Input
                id="activation-username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                placeholder="friend@example.com"
                disabled={isBusy}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="activation-token" className="text-sm font-medium">
                Access token
              </label>
              <textarea
                id="activation-token"
                value={token}
                onChange={(event) => setToken(event.currentTarget.value)}
                placeholder="Paste access token"
                disabled={isBusy}
                required
                rows={5}
                className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="mt-6 w-full" disabled={isBusy}>
            {isBusy ? "Verifying…" : "Activate workspace"}
          </Button>
        </form>
      </div>
    </main>
  );
}
