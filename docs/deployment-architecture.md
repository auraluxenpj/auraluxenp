# Auraluxe deployment architecture

## Source of truth

- GitHub repository: `auraluxenpj/auraluxenp`
- Release branch: `main`
- Current work: `feature/auraluxe-hybrid-fashion-storefront`
- CI: GitHub Actions (production build, ESLint, isolated migration verification)

## Hosting

- Provider: Cloudflare Workers
- Existing production Worker: `auraluxenpj`
- Cloudflare account: `3ecd048ec38302f3c4718c485b0e76d5`
- Workers subdomain: `auraluxe26`
- Worker URL: `https://auraluxenpj.auraluxe26.workers.dev`
- Deployment workflow: `.github/workflows/deploy-cloudflare.yml`
- Deployment target is intentionally restricted to `main`. Feature-branch workflow dispatch must not deploy production.
- The workflow must update the existing `auraluxenpj` Worker, never create a differently named production Worker.

## Database and backend

- Provider: Supabase
- Production project: `jsshaoucrjorbyuzagdr`
- Project name: `auraluxe-production`
- Region: `ap-south-1`
- The Supabase CLI project reference is maintained in `supabase/config.toml`.
- Production schema changes must be committed as reviewed SQL migrations, applied to this exact project, and verified before deploying code that depends on new columns or tables.

## Release sequence

1. Commit changes to the feature branch.
2. Pass GitHub Actions build, lint and relevant isolated database checks.
3. Review the pull request and confirm no production data changes are included unintentionally.
4. Apply the required Supabase migration to `jsshaoucrjorbyuzagdr` and verify the resulting schema.
5. Merge the reviewed pull request to `main`.
6. GitHub Actions builds the application and deploys the existing `auraluxenpj` Cloudflare Worker.
7. The same workflow smoke-tests the Worker URL, manifest and favicon.

## Explicit exclusions

- Vercel is not an application host, preview provider, CI runner or release target.
- Lovable is not used for development or deployment. The legacy Vite config adapter remains temporarily as a build-time dependency until its plugin configuration can be safely replaced and independently tested.
- Do not create duplicate production Workers, Cloudflare accounts, or Supabase projects.
