# Moving data from the old MongoDB

Until July 2026 the app stored projects in MongoDB Atlas (cluster `ifclca-02`).
That cluster no longer exists. User accounts are not affected: they live in
Clerk, and every row stores the Clerk user id (`user_…`), so imported projects
reappear under the same accounts.

This is only needed if a backup turns up (an Atlas snapshot, or a
`mongodump`). No import script ships with the app because there is no data to
test one against. The mapping below is what such a script needs.

## 1. Get the data out

1. Restore the snapshot into a local `mongod` (Atlas snapshots download as a
   `mongod` data directory or an archive for `mongorestore`).
2. Export the collections as JSON lines:

   ```bash
   for c in projects uploads elements materials indicatorsKBOB material_deletions; do
     mongoexport --uri "$MONGO_URI" --collection "$c" --out "$c.jsonl"
   done
   ```

## 2. Prepare Postgres

```bash
DATABASE_URL=… npm run db:migrate   # create tables
DATABASE_URL=… npm run kbob:sync    # fill kbob_materials first
```

## 3. Map the collections

Keep the Mongo ObjectId hex string as the new `id`. The id columns are plain
text, so old links like `/projects/65f…` keep working.

| Mongo | Postgres | Notes |
|---|---|---|
| `projects` | `projects` | `calculationArea.{type,value,unit}` → `calculation_area_*`. Drop `emissions` (now computed on read). |
| `uploads` | `uploads` | `status` values are already `Processing` / `Completed` / `Failed`. Map anything else (one old path wrote `"completed"`) to `Completed`. |
| `materials` | `materials` | `kbobMatchId` is a Mongo id of `indicatorsKBOB`. Look up that document's `uuid` and store it as `kbob_id`. If it has no `uuid` (pre-API data), leave `kbob_id` null; the user re-matches it. Drop `volume` (computed). |
| `elements` | `elements` | One row per element. `classification.{system,code,name}` → `classification_*` if present (older uploads usually lack it). |
| `elements[].materials[]` | `element_materials` | One row per entry: `element_id` = parent element `_id`, `material_id` = `material`, plus `volume`, `fraction`. Drop `indicators`, `density`, `mass` (computed). |
| `material_deletions` | `material_deletions` | Straight copy. |
| `indicatorsKBOB` | (not imported) | Use the fresh sync instead; only needed for the `uuid` lookup above. |

Mongo `createdAt` / `updatedAt` map to `created_at` / `updated_at`.

## 4. Check

- Rows whose `project_id` points at a missing project will fail the foreign
  key. Skip them; they were orphans in Mongo too (no transactions on some old
  write paths).
- Spot-check one project's totals in the UI against a screenshot or export
  from before, if one exists. Totals are now computed from layers, so a
  project whose stored `emissions` had drifted will show the corrected number.
