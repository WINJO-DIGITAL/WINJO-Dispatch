# Deployment

Nothing in this repository deploys itself to production. A production deploy is an action the owner approves each time (`CLAUDE.md`, "Secrets, deploys and production"). Merging to `main` does not deploy.

## The two Vercel projects

| Project | Serves | Root directory | Address |
|---|---|---|---|
| `winjo-dispatch` (`prj_1TscAwPpnsRSyx3xhYXRK0nrppN2`) | The website, the API and the Operator app (under `/operator`) | the repository root | `https://winjo-dispatch.vercel.app` |
| `winjo-driver` (`prj_Zf6uGdTX4FtCeSwPQvSu54BOpRGW`) | The Driver App (under `/driver`) | `apps/driver` | `https://winjo-driver.vercel.app`, reached through the main site's `/driver` forward (`vercel.json`) |

Team: `winjodigital` (`team_RhhxQIJqo6pFuKaXFV7lWZuW`). Two Next apps cannot share one project's `builds`, which is why the Driver App is its own project.

## The ignore-build-step guard: exactly how it works

Both projects have the same **Ignored Build Step** (a project setting in Vercel, Settings, Git, not a file in this repository):

```
if [ "$VERCEL_ENV" = "production" ]; then exit 0; else exit 1; fi
```

Vercel reads the exit code like this: **exit 0 means "skip this build" (the deployment is cancelled); exit 1 means "go ahead and build".** So:

- **Any push that is not production builds.** A push to any branch makes a preview deployment (on the Driver project it lands in its custom environment `staging`). Both projects build every such push, whichever files changed, so a change under `apps/driver` always builds the Driver App and a change anywhere builds the website and Operator app. Nothing is skipped by path.
- **A production deployment made by Git is cancelled.** Pushing or merging to `main` creates a production deployment which the guard cancels straight away: it shows as CANCELED in the Vercel list. That is expected, not a failure, and it is the protection: merging to `main` cannot put anything live.
- **Production only happens when someone lifts the guard for that one deploy.** See "Deploying to production" below.

Checked against the live deployment list on 17/11/2026: the preview builds of the launch-readiness branch were READY on both projects, and the production builds of `main` were CANCELED.

### Optional refinement, not applied

If previews should skip builds that cannot affect a project (for example a docs-only push), the setting could be a path-aware command. For the Driver project, with its root directory `apps/driver`:

```
if [ "$VERCEL_ENV" = "production" ]; then exit 0; fi; git diff --quiet HEAD^ HEAD -- . && exit 0; exit 1
```

This skips production and any push that changed nothing under `apps/driver`, and builds otherwise. It was **not** applied: it saves little, it needs `HEAD^` to be available in Vercel's clone, and the current rule is simple and never skips a build that matters. The Driver App imports nothing from outside `apps/driver`, so a path check would be correct today, but anyone adding a shared package would have to widen it.

## Deploying to production

Every production deploy needs the owner's approval for that action. The steps, the way they have been done so far, through the Vercel API with the credential held in the environment's secure store (never in the repository or in chat):

1. **Lift the guard** on the project: set its `commandForIgnoringBuildStep` to `null`.
2. **Create the deployment** with `target: production` from the commit on `main` (the project's GitHub link, repository id `1457166703`). For the Driver App use project `winjo-driver`.
3. **Wait until it is READY.**
4. **Restore the guard** to the exact value above. Do this even if the deploy failed.
5. **Check it:** the home page, `/operator`, `/driver/login`, `/signup` and `GET /api/health` (see `docs/ENVIRONMENT.md`).

Test deployments of the Driver App use its custom environment `staging`, not production.

## The optional manual GitHub Action

`.github/workflows/deploy.yml` ("Deploy to Vercel (manual)") is a second way to do step 1 to 4 in one go. It only runs when someone starts it from the Actions tab, types `deploy`, and runs it on `main`. It runs `npx vercel deploy --prod` from the repository root, so **it deploys the website project only**; the Driver App is a separate project and is not covered by it.

It needs, in the GitHub repository's Settings, Secrets and variables, Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `VERCEL_TOKEN` | A Vercel access token for the `winjodigital` team |
| Variable | `VERCEL_ORG_ID` | `team_RhhxQIJqo6pFuKaXFV7lWZuW` |
| Variable | `VERCEL_PROJECT_ID` | `prj_1TscAwPpnsRSyx3xhYXRK0nrppN2` |

The guard still applies to a CLI production deploy, so the Action only produces a live deployment after the guard has been lifted as in step 1. Until the owner wants this route, it can stay unconfigured: the API route above works without it.

## Environment variables

Every variable, what it does and how to generate each secret is in `docs/ENVIRONMENT.md`. A new or changed value only takes effect on the next deploy, so redeploy after setting one. `GET /api/health` reports which required settings are present (true or false, never a value).

## Database changes

Live database changes are applied by the owner or with the owner's approval, then the baseline is rebuilt (`supabase/baseline/README.md`). Edge functions are deployed to the Supabase project `lztbivgmhcgohhvgakyu` (`apps/driver/supabase/functions`).
