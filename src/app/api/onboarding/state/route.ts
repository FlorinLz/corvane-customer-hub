import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { loadOnboardingState } from "@/server/queries/onboarding";

// The scenario panel's checks (src/lib/onboarding/content.ts). Demo only: it names the demo's own issues.
export const GET = handle("onboarding.state", async () => {
  if (process.env.DEMO_MODE !== "true") throw new NotFoundError();
  return loadOnboardingState();
});
