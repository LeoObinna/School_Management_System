/**
 * POST /api/v1/school-settings/logo  (multipart)
 *
 * Replaces the school logo. The new bytes are stored in R2 FIRST
 * (storage-first ordering), then `school.logo_key` is repointed and the
 * previous object is deleted best-effort. Raster images only
 * (png/jpeg/webp/gif) — the logo is served inline, so SVG is rejected.
 * Requires school.settings.update.
 */
import { defineEventHandler } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { readUpload } from '~/server/utils/multipart'
import {
  assertR2Available,
  buildObjectKey,
  deleteObject,
  putObject,
} from '~/server/utils/storage'
import {
  getSchoolSettings,
  setSchoolLogoKey,
} from '~/server/services/school-settings'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'school.settings.update')
  const { file, meta } = await readUpload(event, 'school_logo')

  // Fail fast before writing anything when storage is unavailable.
  assertR2Available(event)

  const previousKey = (await getSchoolSettings(event)).logoKey || null
  const objectKey = buildObjectKey(
    'school/logo',
    [],
    meta.fileName,
    crypto.randomUUID(),
  )

  await putObject(event, objectKey, new Uint8Array(await file.arrayBuffer()), meta.mimeType)

  try {
    const updated = await setSchoolLogoKey(event, objectKey)
    // The old logo is now unreferenced; best-effort cleanup only.
    if (previousKey && previousKey !== objectKey) {
      await deleteObject(event, previousKey).catch(() => {})
    }
    await writeAudit(event, {
      userId: auth.user.id,
      action: 'school_settings.logo.upload',
      resource: 'school_settings',
      resourceId: objectKey,
      description: `Uploaded school logo "${meta.fileName}" (${meta.sizeBytes} bytes).`,
    })
    return updated
  } catch (e) {
    // Do not orphan the new bytes if the metadata repoint failed.
    await deleteObject(event, objectKey).catch(() => {})
    throw e
  }
})
