# Iteration Plan – FreshTrack

This document breaks the 9-week development effort for **FreshTrack** into four sprints. It maps the ten user stories from [`BACKLOG.md`](BACKLOG.md) to sprints, defines a sprint goal and a definition of done for each, and assigns a primary owner per story.

---

## Assumptions

- The project runs from **Week 2** (after Practical 1) to the end of **Week 10**, when the Assessment 3 project report is due.
- The team has **three members**: Bo Yuan (PM / Backend), Shiheng Wang (Frontend / UI), Liangzhe Cai (Database / Tester / Documentation).
- The technology stack is React on the frontend, Python Flask on the backend, and SQLite during development.
- Sprints are **two weeks** long, except Sprint 4 which is **three weeks** to allow time for final report writing, UAT, and presentation prep.

---

## Sprint Roadmap

| Sprint | Weeks | Theme | Stories |
|---|---|---|---|
| Sprint 1 | Weeks 2–3 | Foundations & Authentication | US1, US2 |
| Sprint 2 | Weeks 4–5 | Pantry Inventory & Expiry Tracking | US3, US4, US5, US6 |
| Sprint 3 | Weeks 6–7 | Smart Features | US7, US8, US9 |
| Sprint 4 | Weeks 8–10 | Analytics, Polish & Delivery | US10 + final QA & report |

> **Note – Week 6 mid-term exam.** The CP3407 mid-term exam falls inside Sprint 3. The team should plan light development work for that week and front-load coding into Week 7.

---

## Sprint 1 – Foundations & Authentication (Weeks 2–3)

**Goal:** Stand up the project skeleton so that a user can register, log in, and reach a (still empty) pantry page.

**Stories:**

| ID | Story | Primary Owner |
|---|---|---|
| – | Project skeleton: Flask backend, React frontend, SQLite schema for `User` and `FoodItem`, basic CI on GitHub Actions | Bo Yuan |
| US1 | User registration | Bo Yuan (backend) + Shiheng Wang (form UI) |
| US2 | User login | Bo Yuan (backend) + Shiheng Wang (form UI) |
| – | Initial unit-test setup (pytest for backend, basic React test config) | Liangzhe Cai |

**Definition of done:**

- A new user can register with username, email, and password.
- Passwords are hashed before being stored.
- A registered user can log in and is redirected to a placeholder pantry page.
- At least one unit test passes in CI on every push to `main`.

---

## Sprint 2 – Pantry Inventory & Expiry Tracking (Weeks 4–5)

**Goal:** Deliver the core pantry CRUD and the expiry risk score, which together make up the minimum useful version of FreshTrack.

**Stories:**

| ID | Story | Primary Owner |
|---|---|---|
| US3 | Add food item | Bo Yuan + Shiheng Wang |
| US4 | View pantry inventory | Shiheng Wang |
| US5 | Edit or delete food item | Bo Yuan + Shiheng Wang |
| US6 | Expiry risk reminder (risk score: low / medium / high) | Bo Yuan |
| – | Integration tests for the pantry endpoints | Liangzhe Cai |

**Definition of done:**

- A logged-in user can add, list, edit, and delete their own food items only.
- Each item displays a risk badge (low / medium / high) based on days until expiry.
- Integration tests cover the four pantry endpoints and the risk-score calculation.

---

## Sprint 3 – Smart Features (Weeks 6–7)

**Goal:** Add the features that turn FreshTrack from an inventory tool into a *smart* pantry assistant.

**Stories:**

| ID | Story | Primary Owner |
|---|---|---|
| US7 | Recipe recommendation (local recipe dataset, ranked by pantry match) | Bo Yuan |
| US8 | Shopping list generation (manual entries + system suggestions) | Shiheng Wang |
| US9 | Waste log (eaten / expired / discarded / donated) | Bo Yuan + Liangzhe Cai |
| – | Seed the local recipe dataset (~20 simple recipes) | Liangzhe Cai |

**Definition of done:**

- Selecting "Suggest recipes" returns a ranked list using items already in the pantry, prioritising items close to expiry.
- The shopping list page lets the user add, tick off, and remove items, and offers system-suggested items.
- Removing an item from the pantry prompts the user to record an outcome, which is stored in the waste log.

---

## Sprint 4 – Analytics, Polish & Delivery (Weeks 8–10)

**Goal:** Deliver the dashboard analytics, run a full quality pass, and finish the Assessment 3 report and presentation.

**Stories:**

| ID | Story / Task | Primary Owner |
|---|---|---|
| US10 | Dashboard analytics (near-expiry items, monthly waste, estimated money lost) | Bo Yuan + Shiheng Wang |
| – | End-to-end manual user acceptance testing across all features | Liangzhe Cai |
| – | Bug fixing and UI polish | Whole team |
| – | Final Assessment 3 report (architecture, V&V strategy, individual contributions) | Liangzhe Cai (lead) + whole team |
| – | Demo / presentation rehearsal | Whole team |

**Definition of done:**

- Dashboard displays the three required metrics and renders correctly with realistic seed data.
- All ten user stories pass manual UAT against their acceptance criteria.
- No high-severity bugs remain open in GitHub Issues at submission.
- The Assessment 3 project report is finalised, committed to the repository, and submitted by the end of Week 10.

---

## Cross-Cutting Practices

- **Weekly stand-up** at the start of each practical session: each member reports done / in-progress / blocked.
- **Sprint review** at the end of each sprint: short demo to the lecturer at the next practical.
- **Sprint retrospective** (15 minutes after each review): one thing to keep, one thing to change.
- **GitHub Issues** track all stories and bugs; each issue is linked to its sprint via a Milestone.
- **Branch strategy:** `main` is always deployable; feature branches per story; PRs require one peer review before merge.

---

## Top Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Mid-term exam in Week 6 reduces dev time | Sprint 3 falls behind | Front-load coding into Week 7; defer low-priority polish to Sprint 4 |
| Recipe dataset too small for useful recommendations | US7 feels weak in the demo | Seed ~20 recipes early in Sprint 3 (owned by Liangzhe Cai) |
| Scope creep into Sprint 4 | Final report is rushed | Hard freeze on new features at the end of Sprint 3; Sprint 4 is fixes + analytics only |
| Uneven contribution between members | Affects individual Assessment 3 marks | All work goes through GitHub PRs; commit history serves as the contribution record |
