### Purpose
Tests are written test-first in each step. This issue checks that nothing fell through the cracks before submission.

### Tasks
- [ ] Every test list in BE-1 to BE-6 is fully checked
- [ ] Read the test name listing top to bottom and confirm every spec number in `docs/requirements.md` (Test naming) has at least one test
- [ ] Review boundary cases: empty tag / tag at exactly the maximum length / order with 51+ line items / order with a total of 0
- [ ] Check the commit history: each `test:` commit comes before its `feat:` commit

### Done when
`npm test` passes and the test name listing reads as a requirement coverage list
