import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { useDemoInfo } from "./hooks/useDemoInfo";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    getLicenseStatus: vi.fn().mockResolvedValue({
      active: true,
      issuerMode: false,
      license: null,
      reason: null,
    }),
    getJobs: vi.fn().mockResolvedValue({ total: 0 }),
  };
});

vi.mock("./hooks/useDemoInfo", () => ({
  useDemoInfo: vi.fn(),
}));

vi.mock("react-transition-group", () => ({
  SwitchTransition: ({ children }: { children: React.ReactNode }) => children,
  CSSTransition: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("./components/OnboardingGate", () => ({
  OnboardingGate: () => null,
}));

vi.mock("./pages/GmailOauthCallbackPage", () => ({
  GmailOauthCallbackPage: () => null,
}));

vi.mock("./pages/HomePage", () => ({
  HomePage: () => <div>overview</div>,
}));

vi.mock("./pages/InProgressBoardPage", () => ({
  InProgressBoardPage: () => null,
}));

vi.mock("./pages/JobPage", () => ({
  JobPage: () => null,
}));

vi.mock("./pages/OnboardingPage", () => ({
  OnboardingPage: () => <div>onboarding</div>,
}));

vi.mock("./pages/OrchestratorPage", () => ({
  OrchestratorPage: () => null,
}));

vi.mock("./pages/SettingsPage", () => ({
  SettingsPage: () => null,
}));

vi.mock("./pages/DesignResumePage", () => ({
  DesignResumePage: () => <div>design-resume-page</div>,
}));

vi.mock("./pages/SignInPage", () => ({
  SignInPage: () => <div>sign-in</div>,
}));

vi.mock("./pages/TrackingInboxPage", () => ({
  TrackingInboxPage: () => null,
}));

vi.mock("./pages/VisaSponsorsPage", () => ({
  VisaSponsorsPage: () => null,
}));

describe("App demo banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows local-only information in demo mode", async () => {
    vi.mocked(useDemoInfo).mockReturnValue({
      demoMode: true,
      resetCadenceHours: 6,
      lastResetAt: null,
      nextResetAt: null,
      baselineVersion: null,
      baselineName: null,
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Demo data is temporary/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not render the demo banner waitlist link when demo mode is disabled", () => {
    vi.mocked(useDemoInfo).mockReturnValue({
      demoMode: false,
      resetCadenceHours: 6,
      lastResetAt: null,
      nextResetAt: null,
      baselineVersion: null,
      baselineName: null,
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "localhost" })).toBeNull();
  });

  it("does not fetch demo info while rendering the sign-in page", async () => {
    vi.mocked(useDemoInfo).mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("sign-in")).toBeInTheDocument();
    expect(useDemoInfo).toHaveBeenCalledWith({ enabled: false });
  });

  it("lets the user dismiss the waitlist banner and keeps it hidden", async () => {
    vi.mocked(useDemoInfo).mockReturnValue({
      demoMode: true,
      resetCadenceHours: 6,
      lastResetAt: null,
      nextResetAt: null,
      baselineVersion: null,
      baselineName: null,
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: /dismiss demo waitlist banner/i,
      }),
    );

    expect(screen.queryByRole("link", { name: "localhost" })).toBeNull();
    expect(localStorage.getItem("jobops.demoWaitlistBannerDismissed")).toBe(
      "1",
    );
  });

  it("renders the neutral Resume Studio route", async () => {
    vi.mocked(useDemoInfo).mockReturnValue({
      demoMode: false,
      resetCadenceHours: 6,
      lastResetAt: null,
      nextResetAt: null,
      baselineVersion: null,
      baselineName: null,
    });

    render(
      <MemoryRouter initialEntries={["/design-resume"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("design-resume-page")).toBeInTheDocument();
  });
});
