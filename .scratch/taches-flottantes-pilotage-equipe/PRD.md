# PRD - Taches flottantes et pilotage equipe

Status: ready-for-agent
Feature: taches-flottantes-pilotage-equipe
Date: 2026-07-01

---

## Problem Statement

L'equipe a besoin d'un moyen rapide de creer des taches pendant qu'elle travaille dans l'ATS, sans quitter la fiche en cours ni ressaisir le contexte. Aujourd'hui, le suivi des taches existe partiellement mais il est trop discret, disperse entre plusieurs blocs, et le modele actuel ne permet pas proprement qu'une meme tache soit visible sur plusieurs fiches.

La direction a aussi besoin d'un bloc de pilotage directement visible dans l'onglet Taches. L'objectif n'est pas de recapitulatif exhaustif, mais de savoir rapidement qui porte quoi, quelles taches sont en retard, quelles taches n'ont pas de responsable, et ou agir en priorite.

Le besoin cle est le suivant : une tache a un seul proprietaire interne, mais peut etre rattachee a plusieurs entites externes, uniquement des candidats et/ou des entreprises. Exemple : "Envoyer CV Candidat 1 a Entreprise X" doit apparaitre sur la fiche du candidat et sur la fiche de l'entreprise, avec un statut unique.

---

## Solution

Mettre en place une V1 composee de deux livrables.

1. Un createur de taches flottant, disponible pour chaque utilisateur connecte, sur toutes les pages de l'application. Il s'ouvre depuis un bouton discret, pre-remplit automatiquement le rattachement externe quand la page courante donne un contexte candidat ou entreprise, et permet d'ajouter d'autres candidats ou entreprises avant creation.
2. Un bloc de pilotage equipe directement visible en haut de l'onglet Taches pour les roles direction, admin et team_leader. Ce bloc met en avant les taches ouvertes, les retards, les taches non assignees et la prochaine echeance par proprietaire interne.

Le modele de donnees repart proprement de zero pour les taches : les anciennes donnees de test peuvent etre ignorees ou supprimees. Une tache conserve un proprietaire interne unique, une echeance, une categorie, une note et un statut global. Ses rattachements externes sont stockes dans une table de liaison dediee supportant plusieurs candidats et plusieurs entreprises.

Les taches ne peuvent pas etre orphelines : au moins un candidat ou une entreprise doit etre rattache avant creation.

---

## User Stories

1. As a recruteur, I want to create a task from anywhere in the ATS, so that I can capture follow-up work as soon as it appears.
2. As a recruteur, I want the floating task creator to be available on candidate pages, so that I can create a candidate-related task without leaving the candidate file.
3. As a recruteur, I want the floating task creator to be available on company pages, so that I can create a company-related task without leaving the company file.
4. As a recruteur, I want the floating task creator to be available on pages without candidate or company context, so that I can still create a task from the dashboard or the Taches page.
5. As a recruteur, I want the current candidate to be automatically attached when I open the creator from a candidate file, so that I do not have to search for the same candidate again.
6. As a recruteur, I want the current company to be automatically attached when I open the creator from a company file, so that I do not have to search for the same company again.
7. As a recruteur, I want to add another candidate to the same task, so that one action can be visible on several candidate files when needed.
8. As a recruteur, I want to add another company to the same task, so that one action can be visible on several company files when needed.
9. As a recruteur, I want to attach both candidates and companies to one task, so that actions such as sending a CV to an enterprise are visible on both relevant records.
10. As a recruteur, I want the task status to be global across all attached records, so that marking it complete from one place completes it everywhere.
11. As a recruteur, I want the creator to block creation until at least one candidate or company is attached, so that the ATS does not become a generic personal todo list.
12. As a recruteur, I want the default task owner to be myself, so that quick capture requires fewer clicks.
13. As a recruteur, I want to assign the task to another internal user, so that I can delegate follow-up work explicitly.
14. As a recruteur, I want the assigned user to receive a notification when I assign them a task, so that delegated tasks are not missed.
15. As a recruteur, I want the default due date to be tomorrow, so that quick tasks have a practical deadline without becoming overdue immediately.
16. As a recruteur, I want to change the due date before creation, so that urgent or longer-term follow-ups are represented correctly.
17. As a recruteur, I want to choose a task category, so that calls, emails, documents, follow-ups and other actions are distinguishable.
18. As a recruteur, I want to add a note, so that the task carries enough context for the owner to act.
19. As a recruteur, I want selected attachments to appear as candidate/company chips, so that I can verify the scope before creating the task.
20. As a recruteur, I want to remove an accidentally selected attachment before creation, so that the task does not appear on the wrong file.
21. As a recruteur, I want contact search to help me find an enterprise, so that selecting a contact still attaches the enterprise only.
22. As a recruteur, I want the task to appear on every attached candidate file after creation, so that each candidate history reflects the work done.
23. As a recruteur, I want the task to appear on every attached company file after creation, so that each company history reflects the work done.
24. As a recruteur, I want task creation to write activity history for each attached candidate and company, so that the record remains traceable.
25. As a recruteur, I want completing a multi-attached task to write completion history for each attached candidate and company, so that histories remain coherent.
26. As a recruteur, I want editing a multi-attached task to keep one shared task, so that changes are not duplicated manually across fiches.
27. As a standard user, I want to see only my relevant task workload by default on the Taches page, so that I can focus on my own work.
28. As a direction user, I want the team pilotage block to be visible immediately at the top of the Taches page, so that I do not miss the management view.
29. As an admin, I want the team pilotage block to be visible immediately at the top of the Taches page, so that I can supervise operations.
30. As a team_leader, I want the team pilotage block to be visible immediately at the top of the Taches page, so that I can manage team workload.
31. As a direction user, I want to see the number of open tasks, so that I can understand current workload.
32. As a direction user, I want to see overdue tasks highlighted, so that I can act on the highest-risk work first.
33. As a direction user, I want to see unassigned tasks highlighted, so that ownerless work does not disappear.
34. As a direction user, I want to see tasks due today, so that I can understand immediate pressure.
35. As a direction user, I want to see a compact card per owner, so that I can compare workload across the team.
36. As a direction user, I want each owner card to show overdue count, open count, today/tomorrow count and next task, so that I can scan priorities quickly.
37. As a direction user, I want the unassigned bucket to appear first when it contains open tasks, so that it is treated as a risk signal.
38. As a direction user, I want to click an owner card and filter the task list below, so that I can inspect the work behind the summary.
39. As a direction user, I want the pilotage block to focus on open work, so that completed history does not dilute the operational view.
40. As a direction user, I want completed tasks to remain secondary, so that the pilotage block stays action-oriented.
41. As a recruteur, I want existing candidate and company task blocks to continue showing relevant tasks, so that familiar fiche workflows do not disappear in V1.
42. As a recruteur, I want local fiche task blocks to display multi-attached tasks consistently, so that I can trust that the same task is shown everywhere.
43. As a recruteur, I want need-specific task blocks to be removed from the main task model, so that tasks are only attached to candidates and companies.
44. As a recruteur, I want a task created from a besoin context, if still exposed in the UI, to attach to the besoin's company rather than to the besoin itself, so that the model stays simple.
45. As a user, I want the UI labels to consistently say Tache, Candidat and Entreprise, so that the ATS vocabulary stays aligned with the domain glossary.

---

## Implementation Decisions

### Product scope

The V1 contains exactly two product surfaces:

- A floating contextual task creator available to every connected user.
- A team pilotage block at the top of the Taches page for direction, admin and team_leader roles.

The floating surface is a creator only. It does not become a second task list, drawer, dashboard or mini Taches page.

### Task ownership

Each task has exactly one internal owner at a time. By default, the owner is the connected user opening the creator. The creator allows assigning the task to another active user. Delegation creates a notification for the assigned user when the assigned user differs from the creator.

The creator tracks both "created by" and "assigned to" so that delegated work remains traceable.

### External attachments

Tasks support multiple external attachments, limited to candidates and enterprises. A task may have:

- one candidate;
- one enterprise;
- multiple candidates;
- multiple enterprises;
- any mix of candidates and enterprises.

At least one candidate or enterprise is required. Tasks without external attachments are not allowed.

Contacts are not durable task attachments. Contact search can be used as a shortcut to find an enterprise, but selecting a contact attaches only the related enterprise.

### Data model

Create a dedicated task attachment table for candidate/company links. The existing direct candidate/company/need foreign-key model should not remain the application source of truth.

Recommended shape:

```ts
type TaskLinkEntityType = "candidate" | "company";

type TaskLink = {
  taskId: string;
  entityType: TaskLinkEntityType;
  entityId: string;
};
```

The database should enforce uniqueness per `(taskId, entityType, entityId)`.

The database should enforce at least one valid link before a created task becomes usable. If a pure database constraint is awkward because links are inserted after the task row, enforce this at the server-action boundary and keep task creation plus link creation in one transaction.

### Besoin simplification

Tasks are no longer attached to besoins. If an existing UI path creates a task from a besoin, the task attaches to the besoin's enterprise. The besoin task block is out of the main V1 and should be removed or hidden as part of simplifying the model.

Existing task test data can be discarded. No compatibility migration is required for real user data.

### Floating creator behavior

The floating creator is rendered inside the authenticated application shell so that every connected user gets their own creator.

The creator detects page context at the highest practical seam:

- Candidate pages provide a candidate context attachment.
- Enterprise pages provide an enterprise context attachment.
- Pages without context provide no initial attachment.

When no context is present, the creator still opens, but creation stays disabled until at least one candidate or enterprise is selected.

The creator fields are:

- title, required;
- category, default follow-up unless the app already uses a better task default;
- due date, default tomorrow;
- assigned owner, default connected user;
- note, optional;
- external attachment chips, at least one required.

The creator supports adding attachments through search. Search results include candidates, enterprises and contacts, but contact selection resolves to the enterprise.

### Multi-attachment display

Task cards, rows and slide-over details should show attachments as readable chips or compact labels.

Compact lists should display the first one or two attachments and then a `+N` indicator. Detailed views should show all attached candidates and enterprises with links to their fiche pages.

The label should not imply that a task has only one entity. Avoid singular-only UI such as a single "Candidat" or "Entreprise" field when several attachments exist.

### Global task status

A multi-attached task remains one task. Completion, reopening, editing and deletion operate on the shared task and are reflected on every attached candidate and enterprise fiche.

Completing the task from any surface completes it everywhere. Reopening it from any surface reopens it everywhere.

### Activity history

Task creation, update, completion, reopening and deletion should create activity history entries for every attached candidate and enterprise.

For a task attached to Candidat 1 and Entreprise X, the same business action should be visible in both histories. History summaries should include the task title and enough attachment context to understand why the event appears there.

### Team pilotage block

The Taches page should show the pilotage block directly above the existing task list/kanban for roles direction, admin and team_leader.

The block is operational, not archival. It prioritizes open work:

- total open tasks;
- overdue tasks;
- unassigned open tasks;
- tasks due today;
- owner cards with open count, overdue count, today/tomorrow count and next due task;
- unassigned card first when it contains open tasks.

Clicking an owner card filters the task list below to that owner. Clicking the unassigned card filters the list to unassigned tasks.

Completed tasks may remain visible elsewhere in the Taches page, but they are not the main signal in the pilotage block.

### Existing fiche task blocks

Candidate and enterprise task blocks can remain as consultation/action surfaces in V1. They should read from the new task attachment model and show all tasks linked to the current candidate or enterprise, including multi-attached tasks.

Local creation from fiche blocks should not become a second divergent creation flow. Prefer routing creation through the floating creator or applying the same creation server action and attachment rules.

### Permissions

All connected users can open the floating creator and create tasks.

All connected users can assign a task to another active internal user.

The team pilotage block is visible only to direction, admin and team_leader roles. Standard users keep their personal task view.

### UI expectations

The floating creator should be compact, quick and non-intrusive. It should not obscure the main fiche unnecessarily and should be easy to close or reset.

The team pilotage block should be immediately visible, compact and scannable. Avoid charts in V1. The goal is fast action, not analytics.

---

## Testing Decisions

The highest-value seam is the server-action boundary for task creation and task updates. Tests at this seam should assert observable behavior: database rows, links, notifications and activity events. They should not assert internal helper call counts or component implementation details.

Recommended server-action behavior tests:

- Creating a task with one candidate creates one task and one candidate link.
- Creating a task with one enterprise creates one task and one enterprise link.
- Creating a task with one candidate and one enterprise creates one shared task and two links.
- Creating a task with multiple candidates and companies creates one shared task and all requested unique links.
- Creating a task with no links fails with a user-facing validation error.
- Selecting a contact during search resolves to a company link, not a contact link.
- The default owner is the connected user when no owner is explicitly selected.
- Assigning a task to another active user creates a notification.
- Completing a task updates the shared task status once and leaves all links intact.
- Reopening a task updates the shared task status once and leaves all links intact.
- Deleting a task removes it from linked candidate and company fiche queries.
- Creating, completing and deleting a linked task creates activity events for every linked candidate and enterprise.

Recommended query tests:

- Loading tasks for a candidate returns tasks linked through candidate task links.
- Loading tasks for an enterprise returns tasks linked through company task links.
- Loading global tasks returns attachments grouped per task rather than duplicate task rows.
- Loading pilotage data includes open, overdue, due-today and unassigned tasks.
- Loading pilotage data excludes deleted tasks.
- Loading pilotage data treats completed tasks as secondary and does not count them as open workload.

Recommended UI/manual verification:

- From a candidate fiche, opening the floating creator preselects that candidate.
- From an enterprise fiche, opening the floating creator preselects that enterprise.
- From a neutral page, the creator opens with no attachment and keeps creation disabled until one is added.
- Adding and removing attachment chips works before creation.
- A multi-attached task appears on every attached candidate and enterprise fiche.
- Completing the task from one fiche updates the other fiche and the Taches page after refresh/revalidation.
- The Taches page shows the pilotage block directly at the top for direction, admin and team_leader.
- A standard user does not see the team pilotage block.
- Clicking an owner card filters the task list below.
- Clicking the unassigned card filters the task list to unassigned tasks.

Because the repo currently relies mostly on Next.js server actions and Drizzle, the best automated tests should sit around the action/query layer once a test database strategy exists. Until then, `npm run build` should be the minimum verification for type and route integration.

---

## Out of Scope

- Building a floating task list or mini task dashboard.
- Building analytics charts for task performance.
- Keeping tasks attached to besoins as a first-class task model.
- Supporting contact-level task attachments.
- Supporting external attachments other than candidates and enterprises.
- Supporting multiple internal owners for one task.
- Migrating real historical task data.
- Reworking all fiche task UI into a final unified design beyond the minimum needed to read the new model.
- Creating recurring tasks or automatic reminders beyond existing notification behavior.
- Building SLA, priority, tags or task dependency features.
- Changing matching, besoin status automation, CV send flow or Ypareo behavior.

---

## Further Notes

- This PRD intentionally keeps the model simpler than the matching model. A matching is still the domain object for candidate-to-besoin progression. A task is only an action to perform, mirrored across candidate and enterprise fiches through task links.
- The existing team view work should be reused where possible, but made visible directly at the top of the Taches page for manager roles.
- The existing Taches page already distinguishes manager roles from standard users; preserve that permission shape unless implementation discovers a stronger reason to change it.
- The phrase "rattachement" is useful for task UI, but avoid confusing it with matching terminology. A task link is not a matching and carries no recruitment lifecycle.
