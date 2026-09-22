# VICTORIOUS CHILDREN SCHOOL — APPLICATION FLOW

**Version:** 2.0

## 1. System Map
```text
PUBLIC WEBSITE
  -> Admissions / Fees / News / Events / Gallery / Contact / Result Checker
  -> Authentication
       -> Admin / Teacher / Student / Parent
```

## 2. Public Flow
Home → About / Academics / Admissions / Fees / News / Gallery / Contact → Apply Now / Pay Fees / Check Results / Portal Login.

## 3. Authentication
Login → validate → find account in D1 → verify password → check status → create secure session → determine role → dashboard.

## 4. Admin
Dashboard → Students / Parents / Teachers / Classes / Subjects / Sessions-Terms / Attendance / Results / Fees / Payments / Admissions / Assignments / Announcements / Documents / Reports / Settings / Audit.

## 5. Student Enrollment
Create student → link guardian → assign class/session → create enrollment → optional account → active student. Archive instead of destructive deletion when history matters.

## 6. Teacher Attendance
Teacher login → assigned class → date → enrolled students → mark → validate → save → audit.

Teachers cannot mark unauthorized classes.

## 7. Teacher Results
Teacher → session → term → assigned class/subject → enter scores → validate → save draft → submit → admin review → approve → publish.

Students/parents see official results only after publication.

## 8. Parent
Login → dashboard → linked child → results / attendance / assignments / announcements / fees → balance / ledger / pay / receipt.

Parent can access only linked children.

## 9. Student
Login → dashboard → timetable / attendance / results / assignments / resources / announcements.

Students cannot edit official results.

## 10. Payment
Parent → fees → select purpose → confirm amount → Worker initializes Paystack → payment → webhook → verify → D1 → payment record + fee ledger + receipt + notification.

Idempotency is required.

## 11. Admissions
Admissions → application → applicant/student/guardian data → documents → review → configurable status.

## 12. Documents
Upload → validate type/size → R2 → D1 metadata → authorized access.

## 13. Communication
Authorized user → announcement → audience → publish → targeted users → read status where supported.

## 14. Permission Flow
Every sensitive request:
```text
Request -> authenticate -> identify -> authorize -> check resource scope -> execute
```

## 15. Critical Rules
1. Server-side authorization.
2. Parent-child restriction.
3. Teacher-class restriction.
4. Student result protection.
5. Result approval/publication.
6. Verified payments.
7. Financial traceability.
8. Archive historical records.
9. Private document authorization.
10. Do not invent unknown business rules.

## 16. Navigation Principle
One authoritative workflow for each business concept: one fee ledger, attendance workflow, result workflow, student record and document service.
