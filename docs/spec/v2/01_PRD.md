# VICTORIOUS CHILDREN SCHOOL — PRODUCT REQUIREMENT DOCUMENT (PRD)

**Version:** 2.0  
**Architecture direction:** Cloudflare-first / D1-first  
**Product:** Victorious Children School Website + School Management System  
**Location:** Ojodu, Lagos, Nigeria  
**Motto:** Not to Equal, But to Excel

## 1. Product Overview
Victorious Children School (VCS) needs one cohesive digital platform combining a professional public school website, secure School Management System, student/parent/teacher/admin portals, admissions, academic records, attendance, fees, payments, communication, assignments, learning resources, secure document storage, auditability and privacy controls.

The platform will be rebuilt around a Cloudflare-first architecture managed primarily from TRAE + Wrangler + Cloudflare.

The current repository is an existing project. This specification supersedes its previous infrastructure direction. Existing useful UI, business logic and code may be reused only after inspection and compatibility review.

## 2. Product Vision
Create a modern, trustworthy and easy-to-use digital platform that makes the school's public presence professional while reducing manual administrative work.

## 3. Goals
- Professional digital presence.
- Centralized school operations.
- Secure role-based portals.
- Reliable academic records.
- Reliable finance workflows.
- Reduced infrastructure complexity.
- Maintainable codebase.

## 4. Primary Users
- Public Visitor
- Administrator
- Teacher
- Student
- Parent/Guardian

## 5. Core Functional Requirements
### Public Website
Home, About, Admissions, Academics, Fees, News, Events, Gallery, Contact, FAQ and approved result checking.

### Authentication
Login, logout, password hashing, secure sessions, RBAC, account status, password reset and authentication throttling.

### Student Management
Create/edit/archive students, enrollments, guardians, academic history and documents.

### Academic Management
Sessions, terms, classes, subjects, class-subject assignments, enrollments, assessments, grades and result publication.

### Attendance
Class attendance, status, teacher entry, authorized corrections and reporting.

### Fees and Payments
Fee structures, fee ledger, balances, payment history, Paystack, verification, receipts and approved bank-transfer information.

A browser redirect must never be the sole proof of payment success.

### Learning
Assignments, deadlines, submissions, resources and feedback where required.

### Communication
Announcements, events, notice board, permitted parent/teacher communication and contact submissions.

### Documents
Student photos, admission documents, report cards, school documents, resources and gallery files. Files belong in R2; metadata belongs in D1.

### Administration
Dashboard, user management, permissions, audit logs, settings, reports and content management.

## 6. UX Requirements
Responsive for computer and tablet, fast, accessible, visually consistent and simple for non-technical school staff.

## 7. Success Metrics
- Student lookup in about 30 seconds or less.
- Normal attendance entry in about 5 minutes or less.
- Parent fee balance retrieval in about 2 minutes or less.
- Digital result retrieval after publication.
- Traceable payment and sensitive-record changes.
- Good desktop/tablet experience.

## 8. Security and Privacy
Use strong password hashing, server-side authorization, parent-child restrictions, teacher-class restrictions, protected results, verified payment webhooks, private documents, audit logs, secret protection and applicable Nigerian privacy requirements.

## 9. Scope Boundaries
First release does not require native apps, biometrics, live video, a full ERP, AI grading or unnecessary third-party infrastructure.

## 10. Canonical School Information
- School: Victorious Children School
- Location: Ojodu, Lagos, Nigeria
- Motto: Not to Equal, But to Excel
- Approximate population: 150–200 students

Earlier project material contains conflicting bank information (Access Bank vs GTBank). **Do not hard-code either account as authoritative until the school owner confirms the current official payment details.**

## 11. Acceptance Principle
Do not invent business rules. Use safe configurable defaults where possible, record unresolved decisions and ask the owner when security, finance, data integrity or production behavior is affected.
