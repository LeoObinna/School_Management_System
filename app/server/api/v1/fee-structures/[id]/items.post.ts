/** POST /api/v1/fee-structures/{id}/items */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/auth/rbac'
import { parseBody, parseInput } from '~/server/utils/validation'
import { feeItemUpsertSchema, uuidSchema } from '~/shared/schemas'
import { addFeeItem } from '~/server/services/finance'
import { writeAudit } from '~/server/utils/audit'

const paramsSchema = z.object({ id: uuidSchema })

export default defineEventHandler(async (event) => {
  const auth = requirePermission(event, 'fees.manage_structure')
  const { id } = parseInput(paramsSchema, {
    id: getRouterParam(event, 'id'),
  })
  const data = parseBody(feeItemUpsertSchema, await readBody(event))
  const structure = await addFeeItem(id, data)
  await writeAudit(event, {
    userId: auth.user.id,
    action: 'fee_structure.item_add',
    resource: 'fee_structure',
    resourceId: id,
    description: `Added fee item "${data.name}".`,
  })
  setResponseStatus(event, 201)
  return structure
})
