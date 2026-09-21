# Promotion Engine

A GitHub Action that automates branch promotion workflows. Promote development branches to QA, and QA branches to beta/production by validating branch naming conventions, creating target branches, and opening pull requests.

## Features

- **Branch naming validation** for dev → QA and QA → beta promotion pathways
- **Automatic branch creation** for QA branches from dev branches
- **Automatic PR creation** with proper descriptions and formatting
- **Beta release label management** — creates the `beta-release` label automatically if absent
- **PR duplicate prevention** — checks for existing open PRs before creating a new one
- **Commit diff detection** — skips PR creation when branches share the same HEAD commit
- **TypeScript implementation** — compiled to `dist/index.cjs` via rslib and run under `node24`

## Usage

Add this action to your GitHub workflow:

```yaml
name: Promote Branch

on:
  workflow_dispatch:
    inputs:
      source-branch:
        description: 'Branch to promote (e.g., dev/feature-name or qa/feature-name)'
        required: true
      promotion-target:
        description: 'Promotion target: qa or beta'
        required: true

jobs:
  promote:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Promote Branch
        uses: abhisin98/avivox-action-promotion-engine@v1
        with:
          source-branch-name: ${{ github.event.inputs.source-branch }}
          promotion-target: ${{ github.event.inputs.promotion-target }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `source-branch-name` | Branch to promote, such as `dev/feature-name` or `qa/feature-name` | Yes | — |
| `promotion-target` | Promotion target: `qa` (dev → QA) or `beta` (QA → beta/main) | Yes | — |
| `github-token` | GitHub token for branch operations and PR creation | No | `${{ github.token }}` |

## Outputs

This action has no declared outputs. All side effects are performed via the GitHub API (branch creation, PR creation, label management).

## Branch Naming Conventions

### Dev → QA Promotion (`promotion-target: qa`)

| Field | Value |
|-------|-------|
| Source pattern | `dev/[a-zA-Z0-9._-]+` |
| Example source | `dev/feature-name` |
| Derived target | `qa/feature-name` |

### QA → Beta Promotion (`promotion-target: beta`)

| Field | Value |
|-------|-------|
| Source pattern | `qa/[a-zA-Z0-9._-]+` |
| Example source | `qa/feature-name` |
| Target | `main` (always) |

## How It Works

### Dev → QA Promotion

1. **Validate source branch** — confirms `dev/feature-name` exists on origin (`git ls-remote`)
2. **Validate branch naming** — ensures source matches `dev/[a-zA-Z0-9._-]+`
3. **Create QA branch** — creates `qa/feature-name` from `dev/feature-name` if it doesn't exist
4. **Detect changes** — compares HEAD commit SHAs between branches (`git rev-parse`)
5. **Skip empty PR** — if SHAs match, no PR is created
6. **Prevent duplicates** — checks for an existing open PR via the GitHub API
7. **Create PR** — opens `dev/feature-name → qa/feature-name` PR if all checks pass

### QA → Beta Promotion

1. **Validate source branch** — confirms `qa/feature-name` exists on origin
2. **Validate branch naming** — ensures source matches `qa/[a-zA-Z0-9._-]+`
3. **Ensure label** — creates the `beta-release` label in the repo if it doesn't already exist
4. **Prevent duplicates** — checks for an existing open PR from this branch to `main`
5. **Create PR** — opens `qa/feature-name → main` PR with the `beta-release` label

## Error Handling

| Error message | Cause | Resolution |
|---------------|-------|------------|
| `Branch does not exist: <name>` | Source branch not found on origin | Verify the branch name and push it to the remote |
| `❌ Invalid dev branch format.` | Source doesn't match `dev/feature-name` | Rename the branch to follow the convention |
| `❌ Invalid QA branch format.` | Source doesn't match `qa/feature-name` | Rename the branch to follow the convention |
| `❌ Unsupported promotion type: <value>` | `promotion-target` is not `qa` or `beta` | Use only `qa` or `beta` as the target |

## File Structure

```text
.
├── action.yml              # Action metadata: inputs, description, runs: node24
├── dist/
│   └── index.cjs           # Compiled bundle (committed; this is what the runner executes)
├── src/
│   ├── index.ts            # Entry point: reads inputs, orchestrates modules, handles errors
│   ├── types.ts            # Shared TypeScript interfaces (ActionInputs, PromotionTarget)
│   ├── inputs.ts           # Reads and returns all core.getInput() values
│   ├── validation.ts       # Step 1: branch-exists check; Step 2: naming regex validation
│   ├── git.ts              # Git CLI wrappers (ls-remote, fetch, checkout, push, rev-parse)
│   ├── promote.ts          # dev→QA flow (Step 3) and QA→beta flow (Steps 4+5)
│   └── github.ts           # Octokit API helpers (PR list/create, label ensure/create)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── rslib.config.ts         # rslib (rspack-based) bundler config → outputs dist/index.cjs
```

## Development

### Prerequisites

- Node.js 24 or later
- Git available on `$PATH`
- A GitHub token with `contents: write` and `pull-requests: write` permissions for testing

### Setup

```bash
npm install
```

### Build

Bundles `src/index.ts` (and all imported modules) into `dist/index.cjs` via rslib:

```bash
npm run build
```

### Type Check

Runs `tsc --noEmit` — zero errors required before committing:

```bash
npm run type-check
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm run test
```

### Clean

```bash
npm run clean
```

## Releasing

```bash
# 1. Make your changes and build
npm run build

# 2. Commit everything — including the updated dist/index.cjs
git add .
git commit -m "feat: describe your change"
git push origin main

# 3. Tag the release (consumers pin to a tag)
git tag v1
git push origin v1
```

Consumers then reference the tag:

```yaml
- uses: abhisin98/avivox-action-promotion-engine@v1
```

## Notes

- Both source branches must follow strict naming conventions before promotion is allowed
- Dev branches can only be promoted to QA (`dev/*` → `qa/*`)
- QA branches can only be promoted to beta/main (`qa/*` → `main`)
- PRs are only created when the branch HEAD commits differ
- The `beta-release` label is automatically created with colour `#FF5733` if missing
- All operations use the provided GitHub token; the default `github.token` is sufficient for most cases

## License

MIT