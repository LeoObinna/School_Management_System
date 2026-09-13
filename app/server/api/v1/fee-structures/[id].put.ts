/** PUT /api/v1/fee-structures/{id} */
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import {
  feeStructureUpdateSchema,
  idParamSchema,
} from '~/shared/schemas'
import { updateFeeStructure } from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.manage_structure')
  const { id } = parseInput(idParamSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(
    feeStructureUpdateSchema,
    await readBody(event),
  )
  const structure = await updateFeeStructure(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'fee_structure.update',
    resource: 'fee_structure',
    resourceId: structure.id,
    description: `Updated fee structure "${structure.name}".`,
  })
  return structure
})
