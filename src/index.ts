// Entry point for the Promotion Engine GitHub Action

import * as core from "@actions/core";
import { getOctokit } from "@actions/github";

import { parseInputs } from "./inputs";
import { promoteToQA, promoteToBeta } from "./promote";
import { validateBranchExists, validateBranchNaming } from "./validation";

/**
 * Main action body — reads inputs, validates, and routes to the correct promotion flow.
 * No business logic lives here; this function only orchestrates the other modules.
 */
async function run(): Promise<void> {
  // Read source-branch-name, promotion-target, and github-token from the runner
  const inputs = parseInputs();

  // Mirrors composite Step 1: confirm the source branch exists on origin
  await validateBranchExists(inputs.sourceBranchName);

  // Mirrors composite Step 2: validate naming convention and promotion target value
  // After this call TypeScript knows inputs.promotionTarget is 'qa' | 'beta'
  validateBranchNaming(inputs.sourceBranchName, inputs.promotionTarget);

  // Initialise the authenticated GitHub API client with the provided token
  const octokit = getOctokit(inputs.githubToken);

  if (inputs.promotionTarget === "qa") {
    // Mirrors composite Step 3: "Create QA Branch or PR"
    await promoteToQA(inputs, octokit);
  } else {
    // inputs.promotionTarget === 'beta' — only remaining value after validateBranchNaming
    // Mirrors composite Steps 4+5: "Ensure beta-release label exists" + "Create Beta PR"
    await promoteToBeta(inputs, octokit);
  }
}

// Run the action and surface any unhandled error as a step failure
run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
