### Purpose
Orders placed before the app is installed never arrive via webhook. Allow importing existing orders in bulk. This is not in the task description, but without it the list is empty right after installation.

### Tasks
- [ ] Page through GraphQL `orders` and pass each through the same upsert as BE-1
- [ ] Add a "Sync" button to the order list (also linked from the empty state)
- [ ] Disable the button while running and show how many orders were imported
- [ ] Decide the time range (check whether orders older than 60 days require `read_all_orders`)

### Done when
After reinstalling the app, existing test orders appear in the list
