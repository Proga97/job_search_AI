import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { LicenseManagerSection } from "./LicenseManagerSection";

vi.mock("@client/api", () => ({
  listLicensees: vi.fn().mockResolvedValue([
    {
      version: 1,
      licenseId: "2b970c8b-b563-48b1-83d6-c3a09f358ca5",
      username: "friend@example.com",
      issuedAt: "2026-07-23T12:00:00.000Z",
      expiresAt: "2027-07-23T23:59:59.999Z",
      token: "test-token",
    },
  ]),
  issueLicense: vi.fn(),
  deleteLicensee: vi.fn(),
}));

function TestQueryProvider({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("LicenseManagerSection", () => {
  it("updates a renewal date without reading a cleared React event", async () => {
    render(<LicenseManagerSection />, { wrapper: TestQueryProvider });

    const expiryInput = await screen.findByLabelText(
      "New expiry for friend@example.com",
    );
    fireEvent.change(expiryInput, { target: { value: "2028-01-15" } });

    expect(expiryInput).toHaveValue("2028-01-15");
  });

  it("reveals the stored token for an issued user", async () => {
    render(<LicenseManagerSection />, { wrapper: TestQueryProvider });

    const viewButton = await screen.findByRole("button", {
      name: "View token for friend@example.com",
    });
    fireEvent.click(viewButton);

    expect(screen.getByText("test-token")).toBeVisible();
  });
});
