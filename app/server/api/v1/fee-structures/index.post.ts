/** POST /api/v1/fee-structures */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody } from '~/server/utils/validation'
import { feeStructureCreateSchema } from '~/shared/schemas'
import { createFeeStructure } from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.manage_structure')
  const data = parseBody(feeStructureCreateSchema, await readBody(event))
  const structure = await createFeeStructure(data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'fee_structure.create',
    resource: 'fee_structure',
    resourceId: structure.id,
    description: `Created fee structure "${structure.name}".`,
  })
  setResponseStatus(event, 201)
  return structure
})
