# QA-HUB Dashboard - Local Development & Deployment Guide

This guide outlines how to run the TestRail KPIs Dashboard locally for development and how to deploy updates to the production Google Cloud Run environment.

## 1. Prerequisites

-   **Node.js**: Ensure Node.js (v18+) is installed.
-   **Google Cloud SDK**: `gcloud` CLI must be installed and authenticated (`gcloud auth login`).
-   **BigQuery Access**: Your Google account must have access to the `testrail-480214` project and `testrail_kpis` dataset.

## 2. Local Development

Running the application locally allows you to make UI/Logic changes and test them against live BigQuery data without deploying.

### Setup
1.  Navigate to the `web` directory:
    ```bash
    cd web
    ```
2.  Install dependencies (if not already done):
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    A `.env.local` file has been created in the `web/` directory with the necessary configuration:
    ```bash
    GCP_PROJECT_ID=testrail-480214
    ```

### ⚠️ iCloud Drive \u0026 Local Build
This project is located in **iCloud Drive** (`Mobile Documents`). To prevent file locking issues during development:
-   **Configuration**: `next.config.ts` has been updated to set `distDir: '/tmp/.next_testrail_kpis'`.
-   **Effect**: Build artifacts are written to your local `/tmp` directory instead of iCloud.
-   **Action**: You can run `npm run dev` normally. If you ever move the project out of iCloud, you can remove this configuration.

### Running the App
Start the development server:
```bash
npm run dev
```
-   The dashboard will be available at: [http://localhost:3005](http://localhost:3005)
-   Changes to code will hot-reload automatically.

## 3. Production Deployment

When you are ready to publish changes to the live URL, use the deployment script.

### Deployment Command
From the `web` directory, run:
```bash
npm run deploy
```

### What this does:
1.  **Builds** the Docker container for the Next.js application.
2.  **Pushes** the image to Google Container Registry (`gcr.io/testrail-480214/testrail-kpis-dashboard:latest`).
3.  **Deploys** the new revision to Cloud Run.

### Verification
Once the script completes, the live dashboard is updated at:
[https://testrail-kpis-dashboard-789788067290.us-central1.run.app/](https://testrail-kpis-dashboard-789788067290.us-central1.run.app/)

## 4. Troubleshooting

-   **BigQuery Connection Errors Locally**:
    -   Ensure you are authenticated: `gcloud auth application-default login`
    -   Verify `GCP_PROJECT_ID` is set in `.env.local`.

-   **Deployment Failures**:
    -   Check the output of `npm run deploy`.
    -   Ensure you have permissions to deploy to Cloud Run in project `testrail-480214`.
