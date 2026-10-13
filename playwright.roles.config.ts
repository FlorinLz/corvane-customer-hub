import base from "./playwright.config";

// Runs only the role-actions project and its own production build (port 3104),
// without starting the other e2e servers: `npx playwright test -c playwright.roles.config.ts`.
const webServer = [base.webServer].flat().filter((w) => w && w.url?.endsWith(":3104"));

const config = { ...base, projects: base.projects?.filter((p) => p.name === "role-actions"), webServer };

export default config;
