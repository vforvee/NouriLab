# NouriLab
**Discover. Analyse. Formulate.**

A responsive alternative-protein ingredient discovery and formulation starter platform.


## Opening the frontend

For the complete application, start the FastAPI server using the setup instructions below and visit `http://127.0.0.1:8000`. The landing page shows the NouriLab intro animation and account form. After signing in or creating an account, users continue to the home page at `/app`; a valid session is required to view it.

## Run locally
Python 3.10+ is required.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```
Open http://127.0.0.1:8000. API documentation: http://127.0.0.1:8000/docs.

## AI blend suggestions
Blend Studio uses the Google Gemini API to suggest a partner ingredient and an experimental starting ratio for a selected protein and food application. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GEMINI_API_KEY` in the server environment before starting the API:

```powershell
# Windows PowerShell
$env:GEMINI_API_KEY = "your-api-key"
```

```bash
# macOS/Linux
export GEMINI_API_KEY="your-api-key"
```

The default model is `gemini-3.5-flash-lite`; override it with `GEMINI_MODEL` if needed. Google currently lists this model for free-tier use, subject to quotas, eligibility and availability that can change. Check your project's current limits in Google AI Studio. Keep the key server-side and never add it to frontend code or commit it. Blend inputs and catalogue descriptions are sent to Gemini to generate the suggestion. Google states that free-tier content may be used to improve its products, so do not submit confidential or personal information. The catalogue has no verified protein composition or functional measurements, so suggestions are hypotheses for bench testing—not optimal ratios or validated safety, nutrition, or performance advice. Without the key, other app features remain available and Blend Studio reports that AI suggestions are not configured.

## Included
- Responsive website and ingredient library
- FastAPI backend and SQLite starter database
- Registration/login and saved blend concepts
- Transparent catalogue-level ingredient screening
- Functional property and research sections
- Gemini-backed experimental blend suggestions

## Scientific integrity
Starter ingredient records are catalogue entries, not a validated research dataset. Functional property values are not fabricated; they remain unavailable until traceable measurements are added. Screening is rule-based catalogue matching, not machine learning. A screening label is not a probability or validated prediction. AI-generated blend ratios are experimental starting hypotheses, not optimized or validated formulations and do not predict ingredient interactions.

## Production
### Deploy to Vercel

Set Vercel's **Root Directory** to `NouriLab_Full_Website`. Vercel detects the root `main.py` FastAPI entrypoint and installs the dependencies listed by the root `requirements.txt`.

Before deploying, add these environment variables in the Vercel project settings for each environment:

- `SECRET_KEY`: a strong, unique random value; do not use the example or a development value.
- `DATABASE_URL`: a persistent PostgreSQL connection string using the SQLAlchemy `postgresql+psycopg://` scheme. SQLite is rejected on Vercel because its filesystem is not persistent.
- `FRONTEND_ORIGIN`: the deployed site's exact HTTPS origin, such as `https://your-project.vercel.app`.
- `GEMINI_API_KEY` (optional): needed only for AI blend suggestions. Keep it server-side.
- `GEMINI_MODEL` (optional): defaults to `gemini-3.5-flash-lite`.

Do not upload `.env` or the local SQLite databases. After deployment, verify `/api/health`, account registration/login, and saved blends against the configured PostgreSQL database.

### Remaining production work

Before public production use, add database migrations and backups, rate limiting, email-based password reset, security review and privacy disclosures. Do not expose admin privileges to public users. See `.env.example`.
