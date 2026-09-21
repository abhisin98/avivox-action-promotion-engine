// dev→QA and QA→beta promotion flows

import * as core from "@actions/core";
import { getOctokit, context } from "@actions/github";

import { branchExistsOnRemote, createAndPushBranch, branchesHaveDiff } from "./git";
import { findOpenPR, createPR, ensureLabelExists } from "./github";
import type { ActionInputs } from "./types";

type Octokit = ReturnType<typeof getOctokit>;

/**
 * Full dev→QA promotion flow.
 * Mirrors composite Step 3: "Create QA Branch or PR".
 *
 * 1. Derives the QA branch name by replacing the 'dev/' prefix with 'qa/'.
 * 2. Creates the QA branch on origin if it does not already exist.
 * 3. Skips PR creation if the two branches share the same HEAD commit.
 * 4. Skips PR creation if an open PR for this pair already exists.
 * 5. Opens a PR from the dev branch into the QA branch.
 *
 * @param inputs - Parsed action inputs
 * @param octokit - Authenticated Octokit client
 */
export async function promoteToQA(inputs: ActionInputs, octokit: Octokit): Promise<void> {
  const source = inputs.sourceBranchName; // e.g. dev/feature-name

  // Mirrors: TARGET="qa/${SOURCE#dev/}" (bash strip-prefix syntax)
  const target = `qa/${source.replace(/^dev\//, "")}`; // e.g. qa/feature-name

  const targetExists = await branchExistsOnRemote(target);
  if (!targetExists) {
    await createAndPushBranch(target, source);
  } else {
    // Mirrors: echo "QA branch already exists: $TARGET"
    core.info(`QA branch already exists: ${target}`);
  }

  // "If the dev branch has new changes relative to the QA branch, open a PR.
  //  If the QA branch is identical to dev, do not create an empty pull request."
  const hasDiff = await branchesHaveDiff(target, source);
  if (!hasDiff) {
    // Mirrors: echo "No diff between $SOURCE and $TARGET, skipping PR creation."
    core.info(`No diff between ${source} and ${target}, skipping PR creation.`);
    return;
  }

  const existingPR = await findOpenPR(octokit, context.repo.owner, context.repo.repo, target, source);
  if (existingPR !== null) {
    return; // findOpenPR already logged "PR already exists: #N"
  }

  // NOTE: The original composite action uses a single-quoted heredoc (<<'EOF'),
  // which means $SOURCE and $TARGET are NOT shell-expanded — they appear as literal
  // dollar-sign strings in the rendered PR body. We preserve that exact behaviour.
  const prBody = [
    "### QA Review Request",
    "",
    "This pull request was auto-generated to promote changes from the developer branch:",
    "",
    "- **Source Branch:** $SOURCE",
    "- **Target Branch:** $TARGET",
    "",
    "QA can review the diff, test the changes, and approve merge into the QA branch.",
  ].join("\n");

  // Mirrors: gh pr create --base "$TARGET" --head "$SOURCE" --title "QA Review: $SOURCE → $TARGET"
  await createPR(
    octokit,
    context.repo.owner,
    context.repo.repo,
    target,
    source,
    `QA Review: ${source} → ${target}`, // title uses real branch names, not literal $SOURCE/$TARGET
    prBody
  );
}

/**
 * Full QA→beta promotion flow.
 * Mirrors composite Steps 4+5: "Ensure beta-release label exists" + "Create Beta PR".
 *
 * 1. Ensures the 'beta-release' label exists in the repo (creates it if absent).
 * 2. Skips PR creation if an open PR from this branch to main already exists.
 * 3. Builds the PR body with $SOURCE expanded (double-quoted heredoc in original).
 * 4. Opens a PR from the QA branch to main with the 'beta-release' label.
 *
 * @param inputs - Parsed action inputs
 * @param octokit - Authenticated Octokit client
 */
export async function promoteToBeta(inputs: ActionInputs, octokit: Octokit): Promise<void> {
  const source = inputs.sourceBranchName; // e.g. qa/feature-name

  // Step 4: ensure the label exists before creating the PR
  await ensureLabelExists(octokit, context.repo.owner, context.repo.repo);

  // Step 5: check for an existing open PR before creating a new one
  const existingPR = await findOpenPR(octokit, context.repo.owner, context.repo.repo, "main", source);
  if (existingPR !== null) {
    return; // findOpenPR already logged "PR already exists: #N"
  }

  // The original uses a double-quoted heredoc (<<EOF) so $SOURCE IS expanded.
  // The heredoc was tab-indented; a sed pipeline then stripped leading spaces per line.
  // We reproduce the final normalised result directly — no sed needed.
  const prBody = [
    "### 📦 Beta Release Promotion",
    "",
    "This pull request was **auto-generated** to promote the QA branch:",
    "",
    `- **Source Branch:** ${source}`, // $SOURCE expanded — actual branch name here
    "- **Target Branch:** `main`",
    "",
    "Once merged, this PR will trigger the **Beta → Production** workflows, ensuring that tested features are safely promoted to the mainline.",
    "",
    "---",
    "",
    "⚠️ Please review carefully before merging to maintain release integrity.",
  ].join("\n");

  // Mirrors: gh pr create --base main --head "$SOURCE" --title "Beta Release: $SOURCE" --label beta-release
  await createPR(octokit, context.repo.owner, context.repo.repo, "main", source, `Beta Release: ${source}`, prBody, ["beta-release"]);
}
