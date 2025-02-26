import { ZodError, ZodSchema } from "zod";

interface ValidationResponse<T> {
  success: boolean;
  data?: T;
  errors?: { [key: string]: string };
}

export async function validateData<T>(
  schema: ZodSchema,
  data: unknown
): Promise<ValidationResponse<T>> {
  try {
    const validData = await schema.parseAsync(data);
    return {
      success: true,
      data: validData as T,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors: { [key: string]: string } = {};

      error.errors.forEach((err) => {
        const path = err.path.join(".");
        formattedErrors[path] = err.message;
      });

      return {
        success: false,
        errors: formattedErrors,
      };
    }

    return {
      success: false,
      errors: {
        _error: "An unexpected error occurred during validation",
      },
    };
  }
}
