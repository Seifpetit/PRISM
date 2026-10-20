# Development

Configuration, commands, project layout and troubleshooting. Back to the [README](../README.md).

## Configuration reference

All settings live in `.env`. See `.env.example` for the full annotated list.

| Variable | Purpose |
|---|---|
| `AI_PROVIDER`, `AI_MODEL` | Default provider and model for generation. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` | Add only the providers you use. |
| `AI_API_KEY` | Optional shared key. Takes precedence over the provider-specific keys. |
| `BACKEND_PORT` | Backend port. Default `4000`. |
| `DATABASE_PATH` | SQLite file. Default `data/prism.db`. |
| `APP_BASE_URL` | Where the "Return to PRISM" link points after Shopify connects. Default `http://localhost:3000`. |
| `CONVERTY_CLIENT_ID`, `CONVERTY_CLIENT_SECRET` | Converty app credentials for order outcomes (confirmed, delivered, returned). See `.env.example`. |
| `PEXELS_API_KEY` | Optional. Free key for the profile banner photo picker; without it a built-in set of 9 is shown. |
| `INTEGRATION_ENCRYPTION_KEY` | Encrypts stored integration tokens. Required to save any connection. |
| `SHOPIFY_APP_CLIENT_ID`, `SHOPIFY_APP_CLIENT_SECRET`, `SHOPIFY_OAUTH_REDIRECT_BASE` | Shopify app credentials and where the browser returns after approval (`http://localhost:4000` in development). |
| `SHOPIFY_SHOP_DOMAIN` | Default store, for example `your-store.myshopify.com`. |
| `META_APP_ID`, `META_APP_SECRET` | Meta app credentials for "Log in with Facebook". Optional: `META_LOGIN_CONFIG_ID` (Facebook Login for Business), `META_OAUTH_REDIRECT_BASE`, `META_OAUTH_SCOPES`. |
| `META_ADS_ACCESS_TOKEN`, `SHOPIFY_ACCESS_TOKEN` | Development-only fallbacks, ignored when `NODE_ENV=production`. |
| `URL_INSPECTION_BROWSER_PATH` | Path to Edge or Chrome for client-rendered storefront inspection. |

## Common commands

| Command | What it does |
|---|---|
| `npm run backend` | Start the API. `npm run backend:dev` restarts on file changes. |
| `npm run dev` | Start the frontend. |
| `npm run db:create` / `npm run db:migrate` | Create the database / apply outstanding migrations. |
| `npm run typecheck` | TypeScript check. |
| `npm run lint` | ESLint. |
| `npm run test:database` | Database, workspace isolation, integration and campaign tests (includes a GraphQL end-to-end test). |
| `npm run test:campaign-rules` | The test-campaign rules (test types, bulk expansion, warnings, CSV export). |
| `npm run test:context-library` | Context Library: reading PDF, text and CSV, the bounded context, ownership rules and a GraphQL end-to-end test against a stand-in model. |
| `npm run test:pipeline` | The production pipeline: stages, per-format checklists, moving and ordering tasks, several tasks per ad, workspace isolation. |
| `npm run test:url-inspection` | URL inspection tests. |
| `npm run test:creative-exploration` | Creative exploration tests. |
| `npm run test:product-context`, `test:ai-cost`, `test:target-avatar` | Other backend suites. |
| `npm run build` | Production build of the frontend. |

## Project layout

| Path | Contents |
|---|---|
| `app/` | Next.js entry (`layout.tsx`, `page.tsx`). |
| `components/` | UI. `new-product/` holds onboarding, `settings/` the personal settings pages, `ui/` shared primitives. |
| `api/` | Frontend GraphQL client (`api.ts`). |
| `store/`, `services/`, `lib/`, `types/` | Client state, data services, helpers and shared types. |
| `backend/server.mjs`, `backend/schema.mjs` | GraphQL server and schema. |
| `backend/ai/` | Prompt templates, output schemas and provider adapters. |
| `backend/database/` | SQLite client, repositories and `migrations/`. |
| `backend/integrations/` | Shopify and Meta Ads. |
| `backend/creative-exploration/` | Audience, angle, avatar and concept generation. |
| `backend/pipeline/` | The production pipeline: stages, per-format checklists and task rules. |
| `backend/context-library/` | The Context Library: reading files, fitting sources to the budget, resolving a generation's context. |
| `data/` | The SQLite database and local ledgers. |
| `docs/` | User guide, integrations, strategy framework, provider pricing notes and the full [codebase map](codebase-map.md). |
| `public/landing/` | The static landing page (see its [README](../public/landing/README.md)). |

[`AGENTS.md`](../AGENTS.md) records product decisions and implementation warnings, and
[`creative-strategy/framework.md`](creative-strategy/framework.md) holds the strategy framework. Read them before
changing how strategy generation works. [`codebase-map.md`](codebase-map.md) maps the code in detail.

## Troubleshooting

- **"Sign in is required" or generation does nothing:** the backend is not running or not reachable on port 4000.
- **Generation fails immediately:** the API key for the selected provider is missing in `.env`. Restart the
  backend after editing `.env`. It only reads the file at startup.
- **Cannot save an integration connection:** `INTEGRATION_ENCRYPTION_KEY` is missing or is not 32 bytes of base64.
- **Port already in use:** stop the other process, or change `BACKEND_PORT` and set `GRAPHQL_BACKEND_URL` to match.
