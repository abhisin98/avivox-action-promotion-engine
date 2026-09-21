// Branch existence and naming convention validation

import * as core from "@actions/core";
import * as exec from "@actions/exec";

import type { PromotionTarget } from "./types";

/**
 * Confirms that the given branch exists on origin using git ls-remote.
 * Mirrors composite Step 1: "Validate source branch exists".
 *
 * @param branch - Remote branch name to check (e.g. dev/feature-name)
 * @throws Error if the branch does not exist on origin
 */
export async function validateBranchExists(branch: string): Promise<void> {
  // --exit-code makes git return code 2 when no matching ref is found
  // ignoreReturnCode lets us inspect the exit code ourselves instead of throwing
  // silent suppresses the ref-listing stdout since we only need the boolean result
  const exitCode = await exec.exec("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], { ignoreReturnCode: true, silent: true });

  if (exitCode !== 0) {
    // Exact message from the original composite action
    throw new Error(`Branch does not exist: ${branch}`);
  }
}

/**
 * Validates the source branch matches the naming convention for the given target,
 * and that the target itself is a supported value ('qa' | 'beta').
 * Mirrors composite Step 2: "Validate branch naming convention".
 *
 * Declared as an assertion function so TypeScript narrows `target` to PromotionTarget
 * for callers after this succeeds.
 *
 * @param source - Source branch name to validate (e.g. dev/feature-name)
 * @param target - Promotion target value to validate ('qa' or 'beta')
 * @throws Error with the original emoji-prefixed message on any violation
 */
export function validateBranchNaming(source: string, target: string): asserts target is PromotionTarget {
  // Mirrors: [[ "$SOURCE" =~ ^dev\/[a-zA-Z0-9._-]+$ ]]
  const DEV_BRANCH_PATTERN = /^dev\/[a-zA-Z0-9._-]+$/;

  // Mirrors: [[ "$SOURCE" =~ ^qa\/[a-zA-Z0-9._-]+$ ]]
  const QA_BRANCH_PATTERN = /^qa\/[a-zA-Z0-9._-]+$/;

  if (target === "qa") {
    if (!DEV_BRANCH_PATTERN.test(source)) {
      throw new Error(["❌ Invalid dev branch format.", "Expected: dev/feature-name", `Received: ${source}`].join("\n"));
    }
  } else if (target === "beta") {
    if (!QA_BRANCH_PATTERN.test(source)) {
      throw new Error(["❌ Invalid QA branch format.", "Expected: qa/feature-name", `Received: ${source}`].join("\n"));
    }
  } else {
    // Any value other than 'qa' or 'beta' is unsupported
    throw new Error([`❌ Unsupported promotion type: ${target}`, "Supported values: qa, beta"].join("\n"));
  }

  // Mirrors: echo "✅ Branch naming convention validated successfully."
  core.info("✅ Branch naming convention validated successfully.");
}
