import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "./generated/prisma";
import { ZodType } from "zod";

export function generateReference(): string {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getPrismaClient(env: any) {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}

export const reqJson = <T extends ZodType>(
  schema: T,
) => ({
  content: {
    'application/json': {
      schema,
    },
  },
})