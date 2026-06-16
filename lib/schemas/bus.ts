import { z } from 'zod'

const busTypeEnum = z.enum(['EV', 'Diesel'])

export const CreateBusSchema = z.object({
  bus_number: z.string().trim().min(1, 'Bus number is required').max(20),
  vin: z.string().trim().max(40).optional(),
  bus_type: busTypeEnum,
  fuel_level: z.number().min(0).max(100).optional(),
  current_mileage: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional(),
})

// .strict() → unknown keys (e.g. status, is_active injected by a caller) are
// rejected, preventing mass-assignment through updateBusAction.
export const UpdateBusSchema = z
  .object({
    bus_number: z.string().trim().min(1).max(20).optional(),
    vin: z.string().trim().max(40).nullable().optional(),
    bus_type: busTypeEnum.optional(),
    fuel_level: z.number().min(0).max(100).nullable().optional(),
    current_mileage: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
