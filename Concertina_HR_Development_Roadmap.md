# Concertina HR - Development & Rollout Roadmap

## 4-Month (16-Week) Technical Timeline

### **Month 1: Core Architecture & MVP Validation**
*Focus: Establishing secure infrastructure, database foundations, and the core time-tracking engine.*

* **Week 1: Infrastructure & Database Initialization**
  * [x] Provision robust PostgreSQL database cluster (via Supabase).
  * [x] Architect relational Prisma Schema (Users, Roles, Schedules, Holidays, Logs).
  * [x] Set up Next.js 14 App Router backend with Server Actions.
* **Week 2: Security & Authentication (RBAC)**
  * [x] Implement NextAuth.js encrypted session management.
  * [x] Build Role-Based Access Control (RBAC) separating Admin, Supervisor, and Team Member routes.
  * [x] Secure API routes against unauthorized data fetching.
* **Week 3: Time Tracking (Clock In/Out) Enginef**
  * [x] Build the Dashboard with dynamic, role-specific UI widgets.
  * [x] Implement core Clock In / Clock Out mutation logic.
  * [ ] Build "Anti-Duplicate" logic to prevent double clock-ins/outs based on active sessions.
* **Week 4: PFFD (Pre-Funded Flex Days) Management**
  * [x] Build PFFD Request forms with date-range validation.
  * [x] Create the Admin/Supervisor Approval workflow dashboard.
  * [ ] Implement automated calculation algorithms to accurately track Remaining vs. Used credits.

### **Month 2: Advanced HR Modules & Data Interconnectivity**
*Focus: Building complex shift logic and tying the time-tracking data into actionable attendance logs.*

* **Week 5: Live Supervisor Monitoring & Dashboards**
  * [ ] Build specialized dashboards for Supervisors to monitor real-time team attendance.
  * [ ] Implement UI filtering (by Department, by Individual, by Date Range).
* **Week 6: Weekly Scheduling Architecture**
  * [x] Develop the Admin Schedule Manager to assign custom 7-day working hours per user.
  * [x] Build personalized employee schedule views.
  * [ ] Code background logic to compare un-logged time against assigned schedules (for late/undertime calculations).
* **Week 7: Company Holidays & Policy Integration**
  * [x] Build the unified Holiday Management module (Regular vs. Special Non-Working).
  * [ ] Link holiday database tables to the time-tracking engine so payroll automatically ignores missing logs on designated official holidays.
* **Week 8: Internal API & Database Optimization**
  * [ ] Begin indexing complex database tables for fast querying.
  * [ ] Refactor Prisma queries to prevent "N+1" data fetching issues as the employee database grows.

### **Month 3: Advanced Reporting & Secondary Modules**
*Focus: Formatting exact payroll outputs, adding Quality-of-Life features, and securing system history.*

* **Week 9: "Version 2" Excel Data Export (Phase 1)**
  * [ ] Integrate `exceljs` library for complex multi-sheet rendering.
  * [ ] Build the precise query to extract the *Attendance Summary* (Total Hours, Missing Logs, PFFD Used).
* **Week 10: "Version 2" Excel Data Export (Phase 2)**
  * [ ] Build the *Detailed Daily Report* sheet matching exact specs (Biologs, Shift Types, Lates, Undertime).
  * [ ] Verify the raw CSV data matches standard Sprout data structures.
* **Week 11: Team Directory, FAQs, & Request Forms (Phase 2 Priority)**
  * [x] Build comprehensive Team Directory.
  * [ ] Finalize the Knowledge Base (FAQ) using rich-text formatting.
  * [ ] Build the centralized internal Request Forms repository.
* **Week 12: Audit Logging & Security Enhancements**
  * [ ] Implement system-wide Audit/Activity Logs (tracking profile changes, login attempts, and approval actions).
  * [ ] Integrate tokenized, secure Email Password Resets via APIs.

### **Month 4: Intensive QA, Parallel Run, & Go-Live**
*Focus: Breaking the app to find edge-case bugs and proving calculated data is 100% payroll-accurate.*

* **Week 13: Edge Case Testing & Load QA**
  * [ ] Perform automated testing on complex edge cases (e.g., an employee clocks in late, leaves early, on a holiday, with a pending PFFD request).
  * [ ] UX/UI polish across mobile and desktop breakpoints.
* **Week 14: User Acceptance Testing (UAT) & Data Migration**
  * [ ] Push to a Staging Environment.
  * [ ] Invite HR and select Supervisors for UAT to click through every module and report UI bugs.
  * [ ] Prepare the historical user import scripts (migrating legacy Sprout balances over).
* **Week 15: The "Parallel Payroll Run"**
  * [ ] **Crucial Step:** Run Concertina HR simultaneously alongside Sprout for two solid weeks (one full payroll cycle).
  * [ ] Daily audits comparing Concertina's new 2-Sheet Excel Export against Sprout's native export to guarantee 100% mathematical parity in undertime/overtime.
* **Week 16: Zero-Downtime Production Launch!**
  * [ ] Fix any minor discrepancies discovered during the parallel run.
  * [ ] Conduct final security checks.
  * [ ] Cancel Sprout legacy software and fully transition the company internal domain to Concertina HR.

***

## Recommended Enterprise Technology Stack

* **Frontend Framework:** **Next.js (React)** — The industry standard for building fast, SEO-friendly, and highly interactive user interfaces.
* **Styling:** **Tailwind CSS** — For building a premium, custom, and responsive design system without heavy CSS files.
* **Backend Runtime:** **Node.js** (via Next.js Server Actions) — For handling API requests and business logic securely on the server.
* **Database Engine:** **PostgreSQL** (hosted on Supabase) — A highly robust, scalable relational database perfectly suited for complex HR relational data.
* **Database ORM:** **Prisma** — Provides type-safe database queries, drastically reducing backend bugs.
* **Authentication & Security:** **NextAuth.js (Auth.js)** — Handles secure, encrypted user sessions and strict Role-Based Access Control (RBAC).
* **Infrastructure & Hosting:** **Vercel** — For seamless, globally distributed, zero-downtime deployments.

Optional Integrated Assets:
* **Tiptap**: For rich-text editing (Announcements and Knowledge Base).
* **date-fns**: Timezone/Shift calculations.

***

## Expected Infrastructure & Maintenance Costs

Developing highly optimized internal tools gives the advantage of bypassing expensive per-user enterprise licenses (like Sprout). To ensure fast loading times globally and strict database reliability, we estimate the following third-party infrastructure costs for a fully scaled production environment:

**1. Application Hosting & CDN Edge Routing (Vercel)**
* **Estimated Cost:** $20.00 / user seat / month (Vercel Pro Plan)
* **Purpose:** Vercel speeds up the application significantly by caching API routes globally, optimizing Javascript bundles, and providing instant deployment previews for developer QA. The Pro plan drastically increases server execution limits, ensuring heavy tasks (like generating multi-sheet Excel exports for 200+ employees) do not time out.

**2. Relational Database Hosting & Security (Supabase)**
* **Estimated Cost:** $25.00 / month (Supabase Pro Plan)
* **Purpose:** Upgrades the PostgreSQL cluster limits from 500MB up to 8GB, implements point-in-time daily automated backups (crucial for HR records), and unlocks dedicated connection pooling to ensure the system doesn't crash if all employees simultaneously clock in at exactly 9:00 AM. 

**3. Transactional Email API (Resend or SendGrid)**
* **Estimated Cost:** Free up to ~3000 emails/month. ~$20.00 / month if scaling beyond that.
* **Purpose:** Necessary to securely and consistently route "Forgotten Password Links", "PFFD Approval Notifications", and "Schedule Change Alerts" without landing in Employee spam folders.

**4. File/Document Storage (Supabase Storage or AWS S3)**
* **Estimated Cost:** ~$5.00 depending on bandwidth scaling.
* **Purpose:** For securely hosting heavy media assets like user profile pictures, HR Request Forms, and static PDF attachments in the knowledge base.

**Estimated Total Infrastructure Overhead:** ~$50.00 - ~$100.00 / month (Scales marginally based on total company size and precise gigabyte storage requirements).
