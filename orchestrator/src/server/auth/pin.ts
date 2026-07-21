import { z } from "zod";

export const PIN_VALIDATION_MESSAGE = "PIN must be exactly 4 digits.";

export const pinSchema = z.string().regex(/^\d{4}$/, PIN_VALIDATION_MESSAGE);
