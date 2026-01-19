import { FieldErrors, FieldValues } from 'react-hook-form'
import { ZodError, ZodSchema } from 'zod'

export const zodResolver = <T extends FieldValues>(schema: ZodSchema<T>) =>
  async (data: T) => {
    try {
      const result = schema.parse(data)
      return { values: result, errors: {} }
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: any = {}

        error.errors.forEach((err) => {
          const path = err.path.join('.')
          if (!fieldErrors[path]) {
            fieldErrors[path] = {
              type: 'validation',
              message: err.message,
            }
          }
        })

        return { values: {}, errors: fieldErrors }
      }
      throw error
    }
  }