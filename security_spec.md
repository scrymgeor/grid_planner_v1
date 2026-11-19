# Grid Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}`, `/users/{userId}/tasks/{taskId}`, `/users/{userId}/habits/{habitId}`, and `/users/{userId}/planner/{plannerId}` belongs strictly to the verified authenticated user whose `request.auth.uid == userId`.
2. Users cannot read, list, create, update, or delete any document belonging to another user.
3. Users must have `request.auth.token.email_verified == true` for all reads and writes.
4. `uid`, `ownerId`, and `createdAt` are immutable once created and must match `request.auth.uid` and `request.time` respectively.
5. `updatedAt` must always equal `request.time` on both create and update.
6. Every string and list has strict `.size()` bounds to prevent resource exhaustion ("Denial of Wallet").

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-User Read**: Authenticated user A attempts `get(/users/userB)` or `get(/users/userB/habits/habit-1)`.
2. **Cross-User Create**: Authenticated user A attempts to create `/users/userB/tasks/task-1` or `/users/userB/habits/habit-1` with `ownerId: "userB"`.
3. **Owner Spoofing**: Authenticated user A attempts to create `/users/userA/habits/habit-1` with `ownerId: "userB"`.
4. **Unverified Email**: Authenticated user with `email_verified: false` attempts to write `/users/userA` or `/users/userA/habits/habit-1`.
5. **Shadow / Ghost Field Injection**: User A creates `/users/userA` or `/users/userA/habits/habit-1` with an extra field `isAdmin: true`.
6. **Immutable Field Mutation**: User A updates `/users/userA/habits/habit-1` attempting to modify `createdAt`, `id`, or `ownerId`.
7. **Timestamp Forgery**: User A creates a task or habit with a backdated client `createdAt` instead of `request.time`.
8. **ID Poisoning**: User A attempts to create `/users/userA/habits/invalid id with spaces and $$$`.
9. **Oversized Title / Target Label**: User A submits a habit with `title.size() == 5000` or `targetLabel.size() == 500`.
10. **Invalid Enum / Duration / Category**: User A submits a task with `priority: "critical"` or `durationMinutes: 99999`, or a habit with `category: "SuperAdmin"`.
11. **Unbounded Lists**: User A writes `blocks` with 250 items (> 200 max) in `/users/userA/planner/state` or `completedDates` with 500 items (> 365 max) in a habit.
12. **Blanket User List Scraping**: User A attempts `list(/users)` or `list(/users/userB/habits)` without owning `userB`.
