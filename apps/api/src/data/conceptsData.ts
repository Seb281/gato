import { db } from '../db/index.ts'
import { and, eq } from 'drizzle-orm'
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

  async updateConceptTranslation(conceptId: number, translation: string): Promise<Concept | undefined> {
    const result = await db
      .update(conceptsTable)
      .set({ translation })
      .where(eq(conceptsTable.id, conceptId))
      .returning()
    return result[0]
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
