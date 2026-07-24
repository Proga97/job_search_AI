import * as api from "@client/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function defaultExpiry(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function LicenseManagerSection() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [renewalDates, setRenewalDates] = useState<Record<string, string>>({});
  const [revealedTokens, setRevealedTokens] = useState<Record<string, boolean>>(
    {},
  );
  const [latestToken, setLatestToken] = useState<api.Licensee | null>(null);
  const queryKey = useMemo(() => ["licensees"] as const, []);
  const licenseesQuery = useQuery({
    queryKey,
    queryFn: api.listLicensees,
  });
  const issueMutation = useMutation({
    mutationFn: api.issueLicense,
    onSuccess: async (licensee) => {
      setLatestToken(licensee);
      setUsername("");
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Access token generated");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Token generation failed",
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteLicensee,
    onSuccess: async (_result, deletedUsername) => {
      setLatestToken((current) =>
        current?.username === deletedUsername ? null : current,
      );
      setRevealedTokens((current) => {
        const next = { ...current };
        delete next[deletedUsername];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Issued user removed");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Unable to remove user",
      ),
  });

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast.success("Token copied");
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-3xl border border-border bg-card p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" />
            Issue access
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Generate a signed offline token. The username and expiration date
            cannot be changed after issuance; refreshing creates a replacement.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <label htmlFor="license-username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="license-username"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                placeholder="friend@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="license-expiry" className="text-sm font-medium">
                Expires
              </label>
              <Input
                id="license-expiry"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.currentTarget.value)}
              />
            </div>
          </div>
        </div>
        <Button
          type="button"
          disabled={!username.trim() || !expiresAt || issueMutation.isPending}
          onClick={() =>
            issueMutation.mutate({ username: username.trim(), expiresAt })
          }
        >
          Generate token
        </Button>
      </section>

      {latestToken ? (
        <section className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Check className="h-4 w-4 text-emerald-600" />
                Token ready for {latestToken.username}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Expires {formatDate(latestToken.expiresAt)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyToken(latestToken.token)}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </div>
          <p className="mt-5 break-all rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-foreground">
            {latestToken.token}
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-semibold">Issued users</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Refreshing replaces the saved token for that username.
            </p>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {licenseesQuery.data?.length ?? 0} users
          </span>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {licenseesQuery.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading users…</p>
          ) : licenseesQuery.data?.length ? (
            licenseesQuery.data.map((licensee) => {
              const renewalDate =
                renewalDates[licensee.username] ??
                licensee.expiresAt.slice(0, 10);
              return (
                <div
                  key={licensee.username}
                  className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {licensee.username}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current expiry · {formatDate(licensee.expiresAt)}
                    </p>
                  </div>
                  <Input
                    type="date"
                    aria-label={`New expiry for ${licensee.username}`}
                    value={renewalDate}
                    onChange={(event) => {
                      const nextExpiry = event.currentTarget.value;
                      setRenewalDates((current) => ({
                        ...current,
                        [licensee.username]: nextExpiry,
                      }));
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title={
                        revealedTokens[licensee.username]
                          ? "Hide generated token"
                          : "View generated token"
                      }
                      onClick={() =>
                        setRevealedTokens((current) => ({
                          ...current,
                          [licensee.username]: !current[licensee.username],
                        }))
                      }
                    >
                      {revealedTokens[licensee.username] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {revealedTokens[licensee.username] ? "Hide" : "View"}{" "}
                        token for {licensee.username}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Copy generated token"
                      onClick={() => void copyToken(licensee.token)}
                    >
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">
                        Copy token for {licensee.username}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Issue replacement token"
                      disabled={issueMutation.isPending}
                      onClick={() =>
                        issueMutation.mutate({
                          username: licensee.username,
                          expiresAt: renewalDate,
                        })
                      }
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">
                        Refresh {licensee.username}
                      </span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Delete issued user"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">
                            Delete {licensee.username}
                          </span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove {licensee.username}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the user and token from your issuer
                            list. A token already activated on another computer
                            remains valid until its expiry because validation is
                            offline.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                              deleteMutation.mutate(licensee.username)
                            }
                          >
                            Delete user
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {revealedTokens[licensee.username] ? (
                    <div className="min-w-0 rounded-2xl bg-muted px-4 py-3 sm:col-span-3">
                      <p className="break-all text-xs leading-5 text-foreground">
                        {licensee.token}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No access tokens have been issued yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
