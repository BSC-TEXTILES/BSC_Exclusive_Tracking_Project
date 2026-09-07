# Frontend — BSC Exclusive Tracking

React 19 + Vite + TypeScript + Tailwind CSS 4 UI with a **light-blue (sky) theme**.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

The dev server proxies `/api` and `/uploads` to the backend at `http://localhost:4000`
(see `vite.config.ts`).

## Pages

- `/` — public landing page with live stats
- `/login` — sign in (demo account quick-fill buttons included)
- `/dashboard` — KPIs, today's checkpoints, weekly chart, activity, GPS sync pill
- `/modules`, `/modules/:slug` — process modules with progress
- `/checkpoints/:id` — fill the compliance form (debounced draft autosave), attach
  evidence (images, PDF, CSV, audio), submit for review
- `/history` — filterable submission history with charts
- `/calendar` — monthly compliance calendar with day details
- `/reports` — compliance/accuracy analytics + CSV export
- `/profile` — update info and password
- `/admin/*` — admin dashboard, live tracking map, users, roles & permissions,
  departments, modules, checkpoints, assignments, submissions review, evidence,
  reports, audit logs, settings
- `/supervisor/*` — team dashboard, approvals, employees, departments, projects,
  activity log, profile, team reports

## Live tracking

`src/lib/tracking.tsx` requests the browser's geolocation on login and then
**every 30 minutes**, posting coordinates to `POST /api/tracking`. The header
shows a "Live GPS" pill with last-sync status. Permission is requested once by
the browser; if denied the app keeps working normally.

## Theme

Design tokens live in `src/index.css` (`@theme`): primary sky `#0ea5e9`,
deep `#0369a1`, light `#e0f2fe`, background `#f0f9ff`.
