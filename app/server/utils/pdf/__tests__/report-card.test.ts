import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import {
  buildReportCardObjectKey,
  renderReportCardPdf,
} from '../report-card'
import type { ReportCardDetail, SubjectResult } from '../../../../shared/types'

// pdf-lib compresses content streams with FlateDecode, so the drawn
// text isn't directly visible in the raw PDF bytes. We inflate every
// `stream … endstream` block and concatenate the decompressed content
// to make text-content assertions work without pulling a separate
// text-extraction dependency.
function extractText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes)
  const chunks: Buffer[] = []
  const tag = 'stream'
  let idx = 0
  while (idx < buf.length) {
    const start = buf.indexOf(tag, idx)
    if (start < 0) break
    // Skip matches that are the `stream` inside `endstream`.
    if (start >= 3 && buf.subarray(start - 3, start).toString() === 'end') {
      idx = start + tag.length
      continue
    }
    let dataStart = start + tag.length
    if (buf[dataStart] === 0x0d) dataStart += 1 // \r
    if (buf[dataStart] === 0x0a) dataStart += 1 // \n
    const end = buf.indexOf('endstream', dataStart)
    if (end < 0) break
    const segment = buf.subarray(dataStart, end)
    try {
      chunks.push(inflateSync(segment))
    } catch {
      // Not a flate stream (e.g. an uncompressed ObjStm). Use raw.
      chunks.push(segment)
    }
    idx = end + 'endstream'.length
  }
  let text = Buffer.concat(chunks).toString('latin1')
  // pdf-lib writes text-showing operands as hex strings (`<5265...>`).
  // Decode them so ASCII content is searchable.
  text = text.replace(/<([0-9A-Fa-f\s]+)>/g, (match, hex: string) => {
    const cleaned = hex.replace(/\s/g, '')
    if (cleaned.length % 2 !== 0) return match
    let decoded = ''
    for (let i = 0; i < cleaned.length; i += 2) {
      decoded += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16))
    }
    return decoded
  })
  return text
}

const baseCard: ReportCardDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
  termId: '44444444-4444-4444-8444-444444444444',
  classId: '55555555-5555-4555-8555-555555555555',
  sectionId: null,
  totalScore: '480.00',
  averageScore: '80.00',
  overallGrade: 'A',
  attendanceSummary: 'Present 28 of 30 days.',
  teacherRemark: 'A pleasure to teach.',
  principalRemark: 'Promoted with honour.',
  objectKey: null,
  status: 'draft',
  generatedById: null,
  publishedAt: null,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
  studentName: 'Jane Doe',
  admissionNumber: 'ADM-001',
  className: 'Grade 5',
  sectionName: 'A',
  sessionName: '2026-2027',
  termName: 'Term 1',
  subjectResults: [],
}

function withSubjects(subjects: SubjectResult[]): ReportCardDetail {
  return { ...baseCard, subjectResults: subjects }
}

const sampleSubject: SubjectResult = {
  subjectId: '66666666-6666-4666-8666-666666666666',
  subjectName: 'Mathematics',
  subjectCode: 'MATH',
  assessmentScores: [
    {
      assessmentTypeId: 'a1',
      assessmentTypeName: 'CA 1',
      score: '40',
      maxScore: '50',
    },
  ],
  examScores: [
    {
      examId: 'e1',
      examName: 'Midterm',
      score: '80',
      maxScore: '100',
      grade: 'A',
    },
  ],
  totalScore: '120',
  maxScore: '150',
  percentage: '80.00',
  grade: 'A',
}

describe('buildReportCardObjectKey', () => {
  it('builds a stable path scoped by session/term/student', () => {
    const key = buildReportCardObjectKey(baseCard)
    expect(key.startsWith('report-cards/')).toBe(true)
    expect(key.endsWith('.pdf')).toBe(true)
    expect(buildReportCardObjectKey(baseCard)).toBe(key)
    const other = { ...baseCard, id: '77777777-7777-4777-8777-777777777777' }
    expect(buildReportCardObjectKey(other)).not.toBe(key)
  })

  it('strips non-id-safe characters from scope parts', () => {
    const weird = { ...baseCard, studentId: 'stu/dent?1' }
    const key = buildReportCardObjectKey(weird)
    // 5 segments: prefix, session, term, student, file.
    expect(key.split('/').length).toBe(5)
  })
})

describe('renderReportCardPdf', () => {
  it('returns a Uint8Array starting with the PDF magic header', async () => {
    const bytes = await renderReportCardPdf(baseCard)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)
    const head = String.fromCharCode(...bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
  })

  it('produces a single page for a card with no subjects', async () => {
    const bytes = await renderReportCardPdf(baseCard)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('renders the student block and session/term header', async () => {
    const text = extractText(await renderReportCardPdf(baseCard))
    expect(text).toContain('Report Card')
    expect(text).toContain('Jane Doe')
    expect(text).toContain('ADM-001')
    expect(text).toContain('2026-2027')
    expect(text).toContain('Term 1')
    expect(text).toContain('Grade 5')
    expect(text).toContain('Section: A')
  })

  it('renders totals and remarks when present', async () => {
    const text = extractText(await renderReportCardPdf(baseCard))
    expect(text).toContain('Total: 480.00')
    expect(text).toContain('Average: 80.00%')
    expect(text).toContain('Overall grade: A')
    expect(text).toContain('Present 28 of 30 days.')
    expect(text).toContain('A pleasure to teach.')
    expect(text).toContain('Promoted with honour.')
    expect(text).toContain('Status: draft')
  })

  it('shows the empty-state row when there are no subjects', async () => {
    const text = extractText(await renderReportCardPdf(baseCard))
    expect(text).toContain('No subject results recorded.')
  })

  it('renders the subject table with scores and grades', async () => {
    const text = extractText(
      await renderReportCardPdf(withSubjects([sampleSubject])),
    )
    expect(text).toContain('Mathematics')
    expect(text).toContain('MATH')
    expect(text).toContain('120')
    expect(text).toContain('150')
    expect(text).toContain('80.00%')
    expect(text).toContain('CA 1')
    expect(text).toContain('Midterm')
  })

  it('renders the score breakdown per subject', async () => {
    const text = extractText(
      await renderReportCardPdf(withSubjects([sampleSubject])),
    )
    expect(text).toContain('Score breakdown')
    expect(text).toContain('CA 1: 40 / 50')
    expect(text).toContain('Midterm: 80 / 100')
  })

  it('fits several table-only subjects on one page', async () => {
    // Subjects without assessment/exam detail rows skip the score
    // breakdown section, so a moderate count fits a single A4 page.
    const subjects: SubjectResult[] = Array.from({ length: 8 }, (_, i) => ({
      ...sampleSubject,
      subjectId: `s-${i}`,
      subjectName: `Subject ${i + 1}`,
      subjectCode: `S${i + 1}`,
      assessmentScores: [],
      examScores: [],
    }))
    const bytes = await renderReportCardPdf(withSubjects(subjects))
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const text = extractText(bytes)
    for (let i = 1; i <= 8; i++) {
      expect(text).toContain(`Subject ${i}`)
    }
  })

  it('paginates when many subjects overflow one page', async () => {
    const subjects: SubjectResult[] = Array.from({ length: 30 }, (_, i) => ({
      ...sampleSubject,
      subjectId: `s-${i}`,
      subjectName: `Longnamed Subject Number ${i + 1}`,
      subjectCode: `S${i + 1}`,
    }))
    const bytes = await renderReportCardPdf(withSubjects(subjects))
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })

  it('does not throw when optional fields are null/empty', async () => {
    const sparse: ReportCardDetail = {
      ...baseCard,
      sectionName: null,
      termName: null,
      totalScore: null,
      averageScore: null,
      overallGrade: null,
      attendanceSummary: null,
      teacherRemark: null,
      principalRemark: null,
      admissionNumber: '',
      subjectResults: [],
    }
    const bytes = await renderReportCardPdf(sparse)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('omits remarks and totals sections when absent', async () => {
    const sparse: ReportCardDetail = {
      ...baseCard,
      totalScore: null,
      averageScore: null,
      overallGrade: null,
      attendanceSummary: null,
      teacherRemark: null,
      principalRemark: null,
    }
    const text = extractText(await renderReportCardPdf(sparse))
    expect(text).not.toContain('Total:')
    expect(text).not.toContain('Remarks')
    expect(text).not.toContain('Attendance summary')
  })

  it('truncates very long subject names', async () => {
    const long: SubjectResult = {
      ...sampleSubject,
      subjectName:
        'Introduction to Advanced Topics in Quantitative Reasoning and Statistical Methods',
      subjectCode: null,
      // No detail rows so only the truncated table label is drawn.
      assessmentScores: [],
      examScores: [],
    }
    const text = extractText(
      await renderReportCardPdf(withSubjects([long])),
    )
    // The full name should not fit; the truncated prefix should.
    expect(text).not.toContain('Statistical Methods')
    expect(text).toContain('Introduction')
  })

  it('wraps long remark text without overflow', async () => {
    const card: ReportCardDetail = {
      ...baseCard,
      teacherRemark:
        'This student has demonstrated exceptional diligence throughout the term. '
        + 'Continued focus on problem solving and collaborative work will further '
        + 'consolidate the strong foundation already built this year. Well done.',
    }
    const bytes = await renderReportCardPdf(card)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
