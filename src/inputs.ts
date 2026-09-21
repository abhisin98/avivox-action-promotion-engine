// Input parsing for the Promotion Engine action

import * as core from "@actions/core";

import type { ActionInputs } from "./types";

/**
 * Reads all action inputs from the GitHub Actions runner environment.
 * This is the only file that calls core.getInput() — all other modules
 * receive data through the ActionInputs object passed from index.ts.
 *
 * @returns Typed ActionInputs object with values read from the runner
 */
export function parseInputs(): ActionInputs {
  // required:true throws automatically when the value is absent or empty
  const sourceBranchName = core.getInput("source-branch-name", { required: true });

  // Value validation ('qa' | 'beta') is enforced later by validateBranchNaming()
  // to preserve the original composite action's step ordering
  const promotionTarget = core.getInput("promotion-target", { required: true });

  // action.yml sets default: ${{ github.token }}, so this is always populated in practice
  const githubToken = core.getInput("github-token", { required: true });

  return {
    sourceBranchName,
    // Cast to PromotionTarget here; validateBranchNaming() enforces the allowed literals
    promotionTarget: promotionTarget as ActionInputs["promotionTarget"],
    githubToken,
  };
}
