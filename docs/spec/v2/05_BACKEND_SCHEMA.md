# VICTORIOUS CHILDREN SCHOOL — BACKEND SCHEMA

**Version:** 2.0  
**Database:** Cloudflare D1 / SQLite

## 1. Principles
Use D1-compatible schema, TEXT IDs where appropriate, INTEGER minor currency units, TEXT + CHECK for enums, explicit foreign keys, indexes and migrations.

## 2. Identity
### users
`id, email, username, password_hash, role, status, last_login_at, created_at, updated_at`

### permissions
`id, key, description`

### role_permissions
`role, permission_id`

### sessions
`id, user_id, token_hash, expires_at, created_at, revoked_at`

## 3. People
### students
`id, admission_number, first_name, middle_name, last_name, date_of_birth, gender, status, photo_document_id, created_at, updated_at, archived_at`

### guardians
`id, first_name, last_name, phone, email, address, relationship, created_at, updated_at`

### student_guardians
`student_id, guardian_id, is_primary, created_at`

### teachers
`id, user_id, staff_number, first_name, last_name, phone, email, status, created_at, updated_at`

## 4. Academic
### academic_sessions
`id, name, start_date, end_date, status, created_at`

### terms
`id, session_id, name, start_date, end_date, status`

### classes
`id, name, level, arm, status, created_at`

### subjects
`id, code, name, level, status`

### class_subjects
`id, class_id, subject_id, teacher_id, session_id, status`

### enrollments
`id, student_id, class_id, session_id, start_date, end_date, status`

## 5. Assessment
### assessments
`id, session_id, term_id, class_id, subject_id, name, type, maximum_score, status, created_at`

### grades
`id, assessment_id, student_id, score, grade, remark, status, created_by, updated_by, created_at, updated_at`

### result_publications
`id, session_id, term_id, class_id, status, approved_by, approved_at, published_at, created_at`

Suggested publication statuses: draft, submitted, approved, published.

## 6. Attendance
### attendance
`id, student_id, class_id, session_id, term_id, attendance_date, status, marked_by, created_at, updated_at`

Suggested statuses: present, absent, late, excused.

## 7. Finance
### fee_structures
`id, session_id, term_id, class_id, name, amount, status, created_at, updated_at`

### fee_ledger
`id, student_id, session_id, term_id, fee_structure_id, entry_type, amount, reference, description, created_at, created_by`

### payments
`id, student_id, amount, currency, provider, provider_reference, status, purpose, verified_at, created_at, updated_at`

Amounts are INTEGER minor units.

## 8. Announcements
### announcements
`id, title, body, audience_type, status, published_at, created_by, created_at, updated_at`

### announcement_reads
`announcement_id, user_id, read_at`

## 9. Assignments
### assignments
`id, class_id, subject_id, teacher_id, title, description, due_at, status, created_at, updated_at`

### submissions
`id, assignment_id, student_id, content, document_id, submitted_at, status, feedback, graded_at`

## 10. Documents
### documents
`id, owner_type, owner_id, r2_key, original_name, mime_type, size, visibility, created_by, created_at`

## 11. Admissions
### applications
`id, application_number, applicant_name, student_name, date_of_birth, guardian_name, guardian_phone, guardian_email, desired_class, status, submitted_at, created_at, updated_at`

### application_documents
`id, application_id, document_id, document_type, created_at`

## 12. Communication
### messages
`id, sender_user_id, recipient_user_id, subject, body, status, created_at, read_at`

## 13. Public Content
Recommended tables:
- `news_posts`
- `events`
- `gallery_albums`
- `gallery_items`
- `faqs`
- `contact_messages`
- `newsletter_subscribers`

## 14. Learning
### learning_resources
`id, title, description, subject_id, class_id, document_id, url, status, created_by, created_at`

## 15. Library
### library_books
`id, title, author, isbn, category, quantity, available_quantity, status, created_at, updated_at`

### library_loans
`id, book_id, student_id, issued_at, due_at, returned_at, status`

## 16. Audit
### audit_logs
`id, actor_user_id, action, entity_type, entity_id, metadata, ip_hash_or_safe_reference, created_at`

Do not store unnecessary sensitive data.

## 17. Indexes
Review indexes for users.email, users.username, students.admission_number, enrollments.student_id/session_id, grades.student_id/assessment_id, attendance.student_id/date, payments.student_id/provider_reference, fee_ledger.student_id, announcements.status, assignments.class_id, documents.owner_id and audit entity fields.

## 18. Seed Data
Development data must be fake. Never seed real credentials, production secrets or real student information.

## 19. Migration Rule
Every schema change requires a migration, local test, review, staging verification and production application.
