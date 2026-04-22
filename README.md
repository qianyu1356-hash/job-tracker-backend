# job-tracker-backend

Independent backend service for the `job-tracker` frontend.

## Stack

- Runtime: Node.js (ESM)
- Server: Native `http` module (no external dependencies)
- Persistence: Local JSON file at `data/db.json`

## Start

```bash
npm run dev
```

Service will run at `http://localhost:3001`.

## Main API

- `GET /api/health`
- `GET /api/meta/enums`
- `GET/POST /api/applications`
- `GET/PATCH/DELETE /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `GET/POST /api/assessments`
- `PATCH /api/assessments/:id`
- `PATCH /api/assessments/:id/done`
- `GET/POST /api/interviews`
- `PATCH /api/interviews/:id`
- `GET /api/messages`
- `PATCH /api/messages/:id/read`
- `PATCH /api/messages/read-all`
- `GET /api/dashboard/summary`
- `GET/PATCH /api/home/goal`
- `GET/POST /api/todos`
- `PATCH/DELETE /api/todos/:id`
- `GET /api/resumes`
- `GET/PATCH /api/settings/profile`
- `GET/PATCH /api/settings/job-status`

## Notes

- This backend includes seed data on first start.
- It applies core business rules:
  - Adding an assessment can auto-promote application status to `assessment`.
  - Adding an interview can auto-promote application status to `interviewing`.
  - Deleting an application cascades to its assessments/interviews.
