import { z } from 'zod'

export const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  path: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  categories: z.array(z.lazy(() => NodeSchema)).optional(),
  subcategories: z.array(z.lazy(() => NodeSchema)).optional(),
  nodes: z.array(z.lazy(() => NodeSchema)).optional(),
  subnodes: z.array(z.lazy(() => NodeSchema)).optional(),
  leafnodes: z.array(z.lazy(() => NodeSchema)).optional()
})

export const TreeSchema = z.object({
  fields: z.array(NodeSchema)
})

export type Node = z.infer<typeof NodeSchema>
export type Tree = z.infer<typeof TreeSchema>