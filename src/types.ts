// Shared TypeScript interfaces and type definitions for the Promotion Engine action

/** Valid promotion directions supported by this action. */
export type PromotionTarget = "qa" | "beta";

/**
 * Parsed inputs returned by parseInputs() and passed to all modules.
 * No module other than inputs.ts should call core.getInput() directly.
 */
export interface ActionInputs {
  /** Branch to promote — e.g. dev/feature-name or qa/feature-name. */
  sourceBranchName: string;

  /** Promotion direction: 'qa' promotes dev→QA, 'beta' promotes qa→main. */
  promotionTarget: PromotionTarget;

  /** GitHub token used for git remote auth and Octokit API calls. */
  githubToken: string;
}
