import { db } from '../db/index.ts'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { tagsTable, conceptTagsTable } from '../db/schema.ts'
import type { Tag } from '../db/schema.ts'

const tagsData = {
  async getUserTags(userId: number): Promise<Tag[]> {
    return db.query.tagsTable.findMany({
      where: eq(tagsTable.userId, userId),
      orderBy: tagsTable.name,
    })
  },

  async createTag(userId: number, name: string, color?: string | undefined): Promise<Tag> {
    const values: { userId: number; name: string; color?: string } = { userId, name }
    if (color !== undefined) values.color = color

    const result = await db
      .insert(tagsTable)
      .values(values)
      .returning()
    return result[0]!
  },

  async updateTag(
    tagId: number,
    userId: number,
    fields: { name?: string | undefined; color?: string | undefined }
  ): Promise<Tag | undefined> {
    const result = await db
      .update(tagsTable)
      .set(fields)
      .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))
      .returning()
    return result[0]
  },

  async deleteTag(tagId: number, userId: number): Promise<Tag | undefined> {
    const result = await db
      .delete(tagsTable)
      .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))
      .returning()
    return result[0]
  },

  async addTagToConcept(conceptId: number, tagId: number): Promise<void> {
    await db
      .insert(conceptTagsTable)
      .values({ conceptId, tagId })
      .onConflictDoNothing()
  },

  async removeTagFromConcept(conceptId: number, tagId: number): Promise<void> {
    await db
      .delete(conceptTagsTable)
      .where(
        and(
          eq(conceptTagsTable.conceptId, conceptId),
          eq(conceptTagsTable.tagId, tagId)
        )
      )
  },

  async getTagsForConcepts(
    conceptIds: number[]
  ): Promise<Map<number, Tag[]>> {
    if (conceptIds.length === 0) return new Map()

    const rows = await db
      .select({
        conceptId: conceptTagsTable.conceptId,
        tagId: tagsTable.id,
        tagName: tagsTable.name,
        tagColor: tagsTable.color,
        tagUserId: tagsTable.userId,
        tagCreatedAt: tagsTable.createdAt,
      })
      .from(conceptTagsTable)
      .innerJoin(tagsTable, eq(conceptTagsTable.tagId, tagsTable.id))
      .where(inArray(conceptTagsTable.conceptId, conceptIds))

    const map = new Map<number, Tag[]>()
    for (const row of rows) {
      const tag: Tag = {
        id: row.tagId,
        userId: row.tagUserId,
        name: row.tagName,
        color: row.tagColor,
        createdAt: row.tagCreatedAt,
      }
      const existing = map.get(row.conceptId)
      if (existing) {
        existing.push(tag)
      } else {
        map.set(row.conceptId, [tag])
      }
    }
    return map
  },

  async getConceptIdsWithAllTags(tagIds: number[]): Promise<number[]> {
    if (tagIds.length === 0) return []

    const rows = await db
      .select({ conceptId: conceptTagsTable.conceptId })
      .from(conceptTagsTable)
      .where(inArray(conceptTagsTable.tagId, tagIds))
      .groupBy(conceptTagsTable.conceptId)
      .having(
        sql`count(distinct ${conceptTagsTable.tagId}) = ${tagIds.length}`
      )

    return rows.map((r) => r.conceptId)
  },
}

export default tagsData
