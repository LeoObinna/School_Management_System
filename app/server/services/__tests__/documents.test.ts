/**
 * Phase 14B documents service tests.
 *
 * The Drizzle DB layer is mocked so we assert visibility enforcement,
 * row mapping and admin-gated mutations without a live D1 runtime.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ActorProfile } from '../../utils/auth/actor'

let selectRows: Array<{ document: Record<string, unknown>; createdByName: string | null }> = []
let inserted: Record<string, unknown> | null = null
let updated: Record<string, unknown> | null = null
let deletedKey: string | null = null
let selectWhereArgs: unknown[] = []

// Chain reads `selectRows` live so beforeEach reassignments take effect.
const chain = {
  select: () => chain,
  from: () => chain,
  leftJoin: () => chain,
  where: (...args: unknown[]) => {
    selectWhereArgs = args
    return chain
  },
  orderBy: () => chain,
  limit: () => chain,
  then: (resolve: (r: typeof selectRows) => void) => resolve(selectRows),
}

vi.mock('../../utils/db', () => ({
  db: {
    select: () => chain,
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted = v
        return {
          returning: () => Promise.resolve([{ id: 'doc-1' }]),
        }
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updated = v
        return { where: () => Promise.resolve([]) }
      },
    }),
    delete: () => ({
      where: () => ({
        returning: () =>
          Promise.resolve([{ objectKey: deletedKey ?? 'documents/school/x.pdf' }]),
      }),
    }),
  },
}))

import {
  listDocuments,
  getDocumentForActor,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../documents'
import { smsForbidden, smsNotFound } from '../../utils/http-errors'

const adminActor: ActorProfile = {
  userId: 'u-admin',
  teacherId: null,
  studentId: null,
  staffProfileId: null,
  children: [],
  isStaff: true,
  isAdmin: true,
}

const teacherActor: ActorProfile = {
  userId: 'u-teacher',
  teacherId: 't-1',
  studentId: null,
  staffProfileId: null,
  children: [],
  isStaff: true,
  isAdmin: false,
}

function docRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    document: {
      id: 'doc-1',
      ownerType: 'school',
      ownerId: null,
      objectKey: 'documents/school/x.pdf',
      fileName: 'policy.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      title: 'School Policy',
      description: null,
      category: null,
      visibility: 'staff',
      createdById: 'u-admin',
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
      ...over,
    },
    createdByName: 'Admin User',
  }
}

describe('documents service — visibility', () => {
  beforeEach(() => {
    selectRows = []
    inserted = null
    updated = null
    deletedKey = null
    selectWhereArgs = []
  })

  it('maps list rows to the JSON model with the uploader name', async () => {
    selectRows = [docRow()]
    const result = await listDocuments({ page: 1, perPage: 20, order: 'asc' }, adminActor)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.title).toBe('School Policy')
    expect(result.data[0]?.createdByName).toBe('Admin User')
    expect(result.data[0]?.objectKey).toBe('documents/school/x.pdf')
  })

  it('does not add a visibility constraint for admins', async () => {
    selectRows = [docRow()]
    await listDocuments({ page: 1, perPage: 20, order: 'asc' }, adminActor)
    const hasVisibility = selectWhereArgs.some(
      (a) => typeof a === 'object' && a !== null && 'visibility' in (a as object),
    )
    expect(hasVisibility).toBe(false)
  })

  it('adds a staff visibility constraint for non-admin staff', async () => {
    selectRows = [docRow()]
    await listDocuments({ page: 1, perPage: 20, order: 'asc' }, teacherActor)
    // The non-admin path pushes at least one where condition (visibility).
    expect(selectWhereArgs.length).toBeGreaterThan(0)
  })

  it('lets an admin read an admin-only document', async () => {
    selectRows = [docRow({ visibility: 'admin' })]
    const access = await getDocumentForActor('doc-1', adminActor)
    expect(access.document.visibility).toBe('admin')
    expect(access.objectKey).toBe('documents/school/x.pdf')
  })

  it('returns 404 (not 403) when a non-admin reads an admin-only document', async () => {
    selectRows = [docRow({ visibility: 'admin' })]
    await expect(getDocumentForActor('doc-1', teacherActor)).rejects.toMatchObject(
      smsNotFound('Document not found.'),
    )
  })

  it('returns 404 when the document does not exist', async () => {
    selectRows = []
    await expect(getDocumentForActor('missing', adminActor)).rejects.toMatchObject(
      smsNotFound('Document not found.'),
    )
  })
})

describe('documents service — mutations are admin-gated', () => {
  beforeEach(() => {
    selectRows = []
    inserted = null
    updated = null
    deletedKey = null
  })

  it('forbids non-admin create', async () => {
    await expect(
      createDocument(
        {
          title: 'X',
          objectKey: 'k',
          fileName: 'x.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          visibility: 'staff',
          ownerType: 'school',
        },
        teacherActor,
      ),
    ).rejects.toMatchObject(smsForbidden())
  })

  it('creates a document as admin and returns the mapped row', async () => {
    selectRows = [docRow({ title: 'New Doc' })]
    const created = await createDocument(
      {
        title: 'New Doc',
        objectKey: 'documents/school/new.pdf',
        fileName: 'new.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        visibility: 'staff',
        ownerType: 'school',
      },
      adminActor,
    )
    expect(inserted?.title).toBe('New Doc')
    expect(inserted?.createdById).toBe('u-admin')
    expect(inserted?.visibility).toBe('staff')
    expect(created.title).toBe('New Doc')
  })

  it('forbids non-admin update', async () => {
    await expect(
      updateDocument('doc-1', { title: 'X' }, teacherActor),
    ).rejects.toMatchObject(smsForbidden())
  })

  it('returns 404 on update when the document is missing', async () => {
    selectRows = []
    await expect(
      updateDocument('missing', { title: 'X' }, adminActor),
    ).rejects.toMatchObject(smsNotFound('Document not found.'))
  })

  it('updates editable fields as admin and bumps updatedAt', async () => {
    selectRows = [docRow({ title: 'Old' })]
    const updated_doc = await updateDocument(
      'doc-1',
      { title: 'New Title', category: 'Policy', visibility: 'admin' },
      adminActor,
    )
    expect(updated?.title).toBe('New Title')
    expect(updated?.category).toBe('Policy')
    expect(updated?.visibility).toBe('admin')
    expect(updated?.updatedAt).toBeTruthy()
    expect(updated_doc.title).toBe('Old') // mock returns the pre-update row
  })

  it('forbids non-admin delete', async () => {
    await expect(deleteDocument('doc-1', teacherActor)).rejects.toMatchObject(
      smsForbidden(),
    )
  })

  it('deletes as admin and returns the object key for R2 purge', async () => {
    deletedKey = 'documents/school/gone.pdf'
    const key = await deleteDocument('doc-1', adminActor)
    expect(key).toBe('documents/school/gone.pdf')
  })
})
