// GitHub REST API helpers using Octokit — replaces all gh CLI calls

import * as core from "@actions/core";
import { getOctokit } from "@actions/github";

/** Octokit client type, derived from @actions/github's getOctokit return type. */
type Octokit = ReturnType<typeof getOctokit>;

/** Label name used throughout the beta promotion flow. */
const BETA_RELEASE_LABEL = "beta-release";

/**
 * Checks whether an open pull request already exists for a given base/head pair.
 * Mirrors: gh pr list --base <base> --head <head> --state open --json number --jq '.[0].number'
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param base - Base branch name (receives the changes)
 * @param head - Head branch name (contains the changes)
 * @returns PR number if an open PR exists, null otherwise
 */
export async function findOpenPR(octokit: Octokit, owner: string, repo: string, base: string, head: string): Promise<number | null> {
  // The REST API requires head in "owner:branch" format to filter by head branch correctly
  const { data: pullRequests } = await octokit.rest.pulls.list({
    owner,
    repo,
    base,
    head: `${owner}:${head}`,
    state: "open",
    per_page: 1, // we only need to know if at least one exists
  });

  if (pullRequests.length > 0 && pullRequests[0] !== undefined) {
    const prNumber = pullRequests[0].number;
    // Mirrors: echo "PR already exists: #$EXISTING_PR"
    core.info(`PR already exists: #${prNumber}`);
    return prNumber;
  }

  return null;
}

/**
 * Creates a pull request and optionally attaches labels to it.
 * Mirrors: gh pr create --base <base> --head <head> --title <title> --body <body> [--label ...]
 *
 * Labels are applied via a separate issues.addLabels call because pulls.create
 * does not accept a labels array — PRs are issues under GitHub's data model.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param base - Base branch name
 * @param head - Head branch name
 * @param title - Pull request title
 * @param body - Pull request description (markdown)
 * @param labels - Optional label names to attach after creation
 */
export async function createPR(octokit: Octokit, owner: string, repo: string, base: string, head: string, title: string, body: string, labels: string[] = []): Promise<void> {
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    base,
    head, // plain branch name for creation (no "owner:" prefix needed here)
    title,
    body,
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);

  if (labels.length > 0) {
    // Add labels via the issues API — PR numbers share the issue number space
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels,
    });
    core.info(`Applied labels: ${labels.join(", ")}`);
  }
}

/**
 * Ensures the 'beta-release' label exists in the repository, creating it if absent.
 * Idempotent — safe to call on every beta promotion run.
 * Mirrors: gh label list | grep -q "^beta-release" || gh label create "beta-release" ...
 *
 * Uses try/catch on GET because the REST API returns 404 when a label does not exist;
 * there is no dedicated "label exists" endpoint.
 *
 * @param octokit - Authenticated Octokit client
 * @param owner - Repository owner
 * @param repo - Repository name
 */
export async function ensureLabelExists(octokit: Octokit, owner: string, repo: string): Promise<void> {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name: BETA_RELEASE_LABEL });
    // Mirrors: echo "Label 'beta-release' already exists."
    core.info(`Label '${BETA_RELEASE_LABEL}' already exists.`);
  } catch (err: unknown) {
    if (isHttpError(err) && err.status === 404) {
      // Mirrors: echo "Label 'beta-release' not found. Creating it..."
      core.info(`Label '${BETA_RELEASE_LABEL}' not found. Creating it...`);
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: BETA_RELEASE_LABEL,
        description: "Marks PRs for beta release promotion",
        color: "FF5733", // Octokit expects hex without the leading '#'
      });
    } else {
      // Re-throw anything other than 404 (e.g. 403 Forbidden)
      throw err;
    }
  }
}

/**
 * Type guard that narrows an unknown thrown value to an Octokit HTTP error shape.
 *
 * @param err - Unknown value caught from a try/catch
 * @returns true if err has a numeric `status` property
 */
function isHttpError(err: unknown): err is { status: number } {
  return typeof err === "object" && err !== null && "status" in err && typeof (err as Record<string, unknown>)["status"] === "number";
}
