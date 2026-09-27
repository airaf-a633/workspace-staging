# M1 Foundations: approval checklist

Tick each box yourself. When every box is ticked, M1 is approved and M2 (WhatsApp inbox) starts.

## Before you start

- [ ] Docker Desktop is running.
- [ ] Load the database and test data: `pnpm db:reset`.
- [ ] Put the keys printed by `pnpm db:start` into `.env`.
- [ ] Start the app: `pnpm dev`. It runs on http://127.0.0.1:3000.
- [ ] Local emails (confirmations, sign-in links) appear at http://127.0.0.1:54324.

## Seed users

Every seed user's password is `Password1234`.

| Email | Who | Role in Qamar Electronics | Teams |
|---|---|---|---|
| khalid@qamar.test | Khalid | Owner | General |
| sara@qamar.test | Sara | Sales manager | Deira shop |
| omar@qamar.test | Omar | Support manager | Dubai Mall shop |
| priya@qamar.test | Priya | Operations manager | Deira shop, Dubai Mall shop |
| hana@qamar.test | Hana | Agent | Deira shop |
| aisha@qamar.test | Aisha | Viewer | Dubai Mall shop |
| noor@noor.test | Noor | Owner of **Noor Salon**, a different business | — |

## Automated checks

- [ ] `pnpm db:test` passes against real Supabase (44 tests).
- [ ] `pnpm test` and `pnpm typecheck` pass.
- [ ] CI is green on the pull request. This needs the GitHub repo.

## Try it yourself

### Sign-in
- [ ] Sign in as Khalid with his password. You land in Qamar Electronics.
- [ ] Sign out, then use "Email me a link". The link arrives in Mailpit and signs you in once.
- [ ] Enter a wrong password. The error is clear and doesn't reveal whether the account exists.
- [ ] Create a new account. You must confirm your email (via Mailpit) before signing in.

### Isolation
- [ ] As Noor, open http://127.0.0.1:3000/w/qamar. You see "not found".
- [ ] As Khalid, open http://127.0.0.1:3000/w/noor. You see "not found".

### Invites
- [ ] As Khalid, go to **Team** and invite a new email as Agent in the Deira shop team. A link is shown once.
- [ ] Open the link in a private window while signed in as a *different* email. It refuses.
- [ ] Open the link in a private window, create an account with the invited email, then join. You land in Qamar Electronics.
- [ ] Use the same link again. It says the link is invalid or expired.
- [ ] Cancel another invite before it's used. It disappears from "Waiting to join".

### Roles
- [ ] As Khalid, change Hana's role to Viewer, then back to Agent.
- [ ] Try to change your own role to Agent. It's refused: a workspace keeps at least one owner.
- [ ] Open **Roles**. The table matches the approved permissions table.
- [ ] Create a custom role "Branch lead" from Sales manager, change a permission, and save. Owner-only permissions can't be selected.
- [ ] Try to delete a role that someone still uses. You're told to move them first.

### Teams
- [ ] As Khalid, create a team "Online" and add Hana to it.
- [ ] As Sara, rename "Deira shop". It works, because it's her team.
- [ ] As Sara, the "Dubai Mall shop" card has no rename form.
- [ ] As Hana or Aisha, there are no Roles links and no invite form.

### Removing members
- [ ] As Khalid, remove Aisha. She can no longer open the workspace.
- [ ] Invite Aisha again with any role. She can rejoin.

## Known gaps (planned, not bugs)
- **Invite emails** aren't sent yet. The owner copies the link until we choose an email provider.
- **Reassignment on removal:** reassigning a removed member's chats, deals and tasks arrives with those features (M2, M3).
- **Styling:** screens are plain on purpose. The design system is applied in M4.
- **Plan limits:** custom roles aren't limited to the Growth plan yet. That comes with billing in M10.
- **Confirmations:** deleting a role or team has no confirmation step yet. Added in M4.
