### Purpose
Make tests easy to write and make requirement coverage readable from test names.

### Tasks
- [ ] Install Vitest and add `npm test`
- [ ] Set up a test SQLite database (e.g. `DATABASE_URL=file:./test.db`): apply the schema before the run and clear data between tests
- [ ] Create `test/fixtures/`
- [ ] Write one sample test following "Test naming" in `docs/requirements.md`, and confirm Red → Green works (commits split as `test:` → `feat:`)

### Done when
`npm test` passes, including a test that uses the database
