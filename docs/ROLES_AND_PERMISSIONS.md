# Roles and Permissions

_M1, approved by the founder 2026-09-27. Built from PRODUCT_DECISIONS.md. This table is the source of truth for the database policies, the server checks and the API._

## How it works
- A member has **one role** per workspace and belongs to one or more **teams**. A branch is a team.
- Each permission has a **scope**:

  | Scope | Meaning |
  |---|---|
  | **All** | the whole workspace |
  | **Team** | records of the member's teams |
  | **Own** | records the member holds, owns, or is assigned to |
  | **—** | no access |

- **Read-only viewers** (a role with no reply or edit rights) are free seats, up to 5.
- **Custom roles** (Growth plan and up) start as a copy of a template and can change any cell except the owner-only rows.
- Every check runs twice: in the database and on the server. The API uses the same checks.

## Role templates

### Conversations

| Permission | Owner | Sales mgr | Support mgr | Ops mgr | Agent | Viewer |
|---|---|---|---|---|---|---|
| See conversations | All | Team | Team | Team | Team | Team |
| Reply (as holder) | All | Own | Own | Own | Own | — |
| Reply without taking over (override) | All | Team | Team | — | — | — |
| Claim unassigned | All | Team | Team | Team | Team | — |
| Hand over (note required) | All | Own + Team | Own + Team | Own | Own | — |
| Add collaborators | All | Own | Own | Own | Own | — |
| Internal notes, @mentions, staff chat | All | Team | Team | Team | Team | Read team |
| Mark spam, block number | All | Team | Team | — | — | — |
| Resolve / reopen | All | Team | Team | Own | Own | — |

### CRM

| Permission | Owner | Sales mgr | Support mgr | Ops mgr | Agent | Viewer |
|---|---|---|---|---|---|---|
| See contacts | All | All | All | All | All | Team |
| Create/edit contacts | All | All | All | All | Own | — |
| Merge contacts | All | All | All | — | — | — |
| Erase a contact (PDPL) | All | — | — | — | — | — |
| See deals (stage) | All | All | All | All | Own | — |
| **See deal values and revenue** | All | All | — | — | Own | — |
| Create/edit deals | All | All | — | — | Own | — |
| Mark Won/Lost | All | All | — | — | Own | — |
| Approve discounts (approval requests) | All | Team | — | — | — | — |
| Tasks | All | Team | Team | All | Own | — |
| Manage pipelines, fields, tags | All | Team pipelines | — | — | — | — |

### Messaging tools

| Permission | Owner | Sales mgr | Support mgr | Ops mgr | Agent | Viewer |
|---|---|---|---|---|---|---|
| Create and submit templates | All | Team | Team | — | — | — |
| Send templates in chats | All | Team | Team | Team | Own | — |
| Create campaigns | All | Team | — | — | — | — |
| Send to segments | All | Team | — | — | — | — |
| Send to imported lists (consent + owner approval) | All | Request only | — | — | — | — |
| Automations | All | Team | Team | Team | — | — |
| Canned replies | All | Team | Team | Team | Use only | — |

### Workspace

| Permission | Owner | Sales mgr | Support mgr | Ops mgr | Agent | Viewer |
|---|---|---|---|---|---|---|
| Reports | All | Team (sales) | Team (support) | Team (ops) | — | Team, no export |
| Export CSV/PDF of a report | All | Team | Team | Team | — | — |
| Bulk export contacts/chats | All | — | — | — | — | — |
| Invite/remove members, change roles | All | — | — | — | — | — |
| Teams, hours, routing rules | All | Own teams | Own teams | Own teams | — | — |
| Connect/remove WhatsApp numbers, Meta billing | All | — | — | — | — | — |
| Email, calendar, store connections | All | Own mailbox/calendar | Own mailbox/calendar | Own mailbox/calendar | Own mailbox/calendar | — |
| Billing and plan | All | — | — | — | — | — |
| API keys | All | — | — | — | — | — |
| Audit log | All | — | — | — | — | — |
| Orders & Delivery pack: dispatch, riders, cash | All | — | — | All | Create orders from chat only | — |

## Fixed rules (no role can change these)
- Only the Owner can erase contacts, bulk export, manage members and roles, manage numbers and billing, create API keys, or read the audit log.
- A workspace always has at least one Owner; the last Owner can't be removed or demoted.
- Nobody sees another workspace's data. That's enforced in the database, not only the app.
- Staff names on replies are never shown to customers.
