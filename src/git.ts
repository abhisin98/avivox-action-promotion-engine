// Git CLI wrappers used by the promotion flows

import * as core from "@actions/core";
import * as exec from "@actions/exec";

/**
 * Returns true if the branch exists on origin, false otherwise.
 * Mirrors: git ls-remote --exit-code --heads origin "<branch>"
 *
 * @param branch - Remote branch name to check
 * @returns true if the remote ref exists, false if absent
 */
export async function branchExistsOnRemote(branch: string): Promise<boolean> {
  // --exit-code returns code 2 when no ref matches; ignoreReturnCode lets us inspect it
  const exitCode = await exec.exec("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], { ignoreReturnCode: true, silent: true });

  return exitCode === 0;
}

/**
 * Creates a new branch on origin by branching off an existing remote branch and pushing it.
 * Mirrors: git fetch origin "$SOURCE" && git checkout -b "$TARGET" "origin/$SOURCE" && git push origin "$TARGET"
 *
 * @param newBranch - Name of the branch to create (e.g. qa/feature-name)
 * @param fromBranch - Existing source branch to branch from (e.g. dev/feature-name)
 */
export async function createAndPushBranch(newBranch: string, fromBranch: string): Promise<void> {
  // Bring the source remote-tracking ref up to date before creating the new branch
  await exec.exec("git", ["fetch", "origin", fromBranch]);

  // Create the new local branch rooted at the fetched remote ref
  await exec.exec("git", ["checkout", "-b", newBranch, `origin/${fromBranch}`]);

  // Push to origin so it is visible to other users and the subsequent PR step
  await exec.exec("git", ["push", "origin", newBranch]);

  // Mirrors: echo "Created QA branch: $TARGET"
  core.info(`Created QA branch: ${newBranch}`);
}

/**
 * Fetches a branch from origin and returns its HEAD commit SHA.
 * Mirrors: git fetch origin "<branch>" && git rev-parse "origin/<branch>"
 *
 * @param branch - Remote branch name to resolve
 * @returns The full commit SHA string for the branch HEAD
 */
export async function getRemoteCommitSha(branch: string): Promise<string> {
  // Fetch first so rev-parse resolves the current remote state, not a stale local ref
  await exec.exec("git", ["fetch", "origin", branch]);

  // Capture stdout chunks to return the SHA as a string instead of printing it
  let sha = "";
  await exec.exec("git", ["rev-parse", `origin/${branch}`], {
    listeners: {
      stdout: (data: Buffer) => {
        sha += data.toString(); // data may arrive in multiple chunks; accumulate all
      },
    },
    silent: true,
  });

  return sha.trim(); // rev-parse appends a newline; trim for clean comparison
}

/**
 * Returns true if headBranch has commits not present in baseBranch (their HEAD SHAs differ).
 * Uses the same SHA comparison technique as the original bash script.
 * Mirrors:
 *   BASE_COMMIT=$(git rev-parse "origin/$TARGET")
 *   HEAD_COMMIT=$(git rev-parse "origin/$SOURCE")
 *   [ "$BASE_COMMIT" != "$HEAD_COMMIT" ]
 *
 * @param baseBranch - The older/target branch (e.g. qa/feature — the base)
 * @param headBranch - The newer/source branch (e.g. dev/feature — the head)
 * @returns true if commits differ, false if branches share the same HEAD
 */
export async function branchesHaveDiff(baseBranch: string, headBranch: string): Promise<boolean> {
  const baseSha = await getRemoteCommitSha(baseBranch);
  const headSha = await getRemoteCommitSha(headBranch);

  return baseSha !== headSha;
}
