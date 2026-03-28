import { db } from '../db/index.ts'
import { and, eq, ilike, inArray, or, desc, asc, sql } from 'drizzle-orm'
import { conceptsTable, usersTable } from '../db/schema.ts'
import type { Concept, NewConcept } from '../db/schema.ts'

const conceptsData = {
  async retrieveUserConcepts(userEmail: string): Promise<Array<Concept>> {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, userEmail),
    })

    if (!user) {
      return []
    }

    const savedConcepts = await db.query.conceptsTable.findMany({
      where: eq(conceptsTable.userId, user.id),
    })

    return savedConcepts
  },

  async findConceptByText(
    userId: number,
    concept: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<Concept | undefined> {
    return db.query.conceptsTable.findFirst({
      where: and(
        eq(conceptsTable.userId, userId),
        eq(conceptsTable.concept, concept),
        eq(conceptsTable.sourceLanguage, sourceLanguage),
        eq(conceptsTable.targetLanguage, targetLanguage)
      ),
    })
  },

  async findConceptById(
    conceptId: number,
    userId: number
  ): Promise<Concept | undefined> {
    return db.query.conceptsTable.findFirst({
      where: and(
        eq(conceptsTable.id, conceptId),
        eq(conceptsTable.userId, userId)
      ),
    })
  },

  async findExistingConcept(
    userId: number,
    concept: string,
    translation: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<Concept | undefined> {
    return db.query.conceptsTable.findFirst({
      where: and(
        eq(conceptsTable.userId, userId),
        eq(conceptsTable.concept, concept),
        eq(conceptsTable.translation, translation),
        eq(conceptsTable.sourceLanguage, sourceLanguage),
        eq(conceptsTable.targetLanguage, targetLanguage)
      ),
    })
  },

  async updateConcept(
    conceptId: number,
    userId: number,
    fields: {
      translation?: string | undefined
      userNotes?: string | null | undefined
      exampleSentence?: string | null | undefined
      state?: string | undefined
    }
  ): Promise<Concept | undefined> {
    const result = await db
      .update(conceptsTable)
      .set(fields)
      .where(and(eq(conceptsTable.id, conceptId), eq(conceptsTable.userId, userId)))
      .returning()
    return result[0]
  },

  async enrichConcept(
    conceptId: number,
    enrichment: {
      phoneticApproximation?: string | null
      commonUsage?: string | null
      grammarRules?: string | null
      commonness?: string | null
      fixedExpression?: string | null
    }
  ): Promise<Concept | undefined> {
    const result = await db
      .update(conceptsTable)
      .set(enrichment)
      .where(eq(conceptsTable.id, conceptId))
      .returning()
    return result[0]
  },

  async searchConcepts(
    userId: number,
    params: {
      search?: string | undefined
      language?: string | undefined
      state?: string | undefined
      conceptIds?: number[] | undefined
      sortBy?: 'date' | 'alpha' | undefined
      sortOrder?: 'asc' | 'desc' | undefined
      page?: number | undefined
      limit?: number | undefined
    }
  ): Promise<{ concepts: Concept[]; total: number }> {
    const conditions = [eq(conceptsTable.userId, userId)]

    if (params.conceptIds) {
      conditions.push(inArray(conceptsTable.id, params.conceptIds))
    }

    if (params.search) {
      const term = `%${params.search}%`
      conditions.push(
        or(
          ilike(conceptsTable.concept, term),
          ilike(conceptsTable.translation, term)
        )!
      )
    }

    if (params.language) {
      const [src, tgt] = params.language.split('->')
      if (src && tgt) {
        conditions.push(eq(conceptsTable.sourceLanguage, src.trim()))
        conditions.push(eq(conceptsTable.targetLanguage, tgt.trim()))
      }
    }

    if (params.state) {
      conditions.push(eq(conceptsTable.state, params.state))
    }

    const where = and(...conditions)

    const orderDir = params.sortOrder === 'asc' ? asc : desc
    const orderCol =
      params.sortBy === 'alpha' ? conceptsTable.concept : conceptsTable.createdAt

    const limit = params.limit ?? 30
    const page = params.page ?? 1
    const offset = (page - 1) * limit

    const whereClause = where ?? eq(conceptsTable.userId, userId)

    const [concepts, countResult] = await Promise.all([
      db.query.conceptsTable.findMany({
        where: whereClause,
        orderBy: orderDir(orderCol),
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conceptsTable)
        .where(whereClause),
    ])

    return { concepts, total: countResult[0]?.count ?? 0 }
  },

  async getLanguagePairs(userId: number): Promise<string[]> {
    const results = await db
      .selectDistinct({
        sourceLanguage: conceptsTable.sourceLanguage,
        targetLanguage: conceptsTable.targetLanguage,
      })
      .from(conceptsTable)
      .where(eq(conceptsTable.userId, userId))

    return results.map((r) => `${r.sourceLanguage}->${r.targetLanguage}`)
  },

  async saveNewConcept(newConcept: NewConcept): Promise<Array<Concept>> {
    const newlySavedConcept = await db
      .insert(conceptsTable)
      .values(newConcept)
      .returning()

    return newlySavedConcept
  },

  async deleteConcept(conceptId: number): Promise<Array<Concept>> {
    const deletedConcept = await db
      .delete(conceptsTable)
      .where(eq(conceptsTable.id, conceptId))
      .returning()
    return deletedConcept
  },
}

export default conceptsData
