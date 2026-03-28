import 'dotenv/config'
import { db } from './index.ts'
import { usersTable, conceptsTable } from './schema.ts'
import { eq } from 'drizzle-orm'

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? 'seb@fake.com'

const concepts = [
  // Spanish -> English
  {
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    concept: 'madrugada',
    translation: 'early morning / dawn',
    phoneticApproximation: 'mah-droo-GAH-dah',
    commonUsage: 'Refers to the hours between midnight and sunrise. "Salimos de fiesta a las 3 de la madrugada."',
    grammarRules: 'Feminine noun (la madrugada). No irregular forms.',
    commonness: 'Very common in everyday Spanish',
    fixedExpression: null,
    state: 'new',
  },
  {
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    concept: 'quedarse en blanco',
    translation: 'to go blank / to draw a blank',
    phoneticApproximation: 'keh-DAR-seh en BLAHN-koh',
    commonUsage: 'Used when someone suddenly forgets what they were going to say. "Me quedé en blanco durante la presentación."',
    grammarRules: 'Reflexive verb phrase. Conjugate "quedarse" and keep "en blanco" fixed.',
    commonness: 'Common in conversational Spanish',
    fixedExpression: 'quedarse en blanco',
    userNotes: 'This happened to me during my Spanish presentation last week!',
    exampleSentence: 'Me quedé en blanco cuando el profesor me hizo la pregunta. — I went blank when the teacher asked me the question.',
    state: 'mastered',
  },
  {
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    concept: 'aprovechar',
    translation: 'to take advantage of / to make the most of',
    phoneticApproximation: 'ah-proh-veh-CHAR',
    commonUsage: 'Often used positively. "Hay que aprovechar el buen tiempo." Common farewell: "Que aproveche" (enjoy your meal).',
    grammarRules: 'Regular -ar verb. Can be transitive or used with "de" (aprovecharse de).',
    commonness: 'Very common',
    fixedExpression: null,
    state: 'learning',
  },
  {
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    concept: 'tutear',
    translation: 'to address someone informally (using "tu")',
    phoneticApproximation: 'too-teh-AR',
    commonUsage: 'Important cultural concept. "En esta empresa todos nos tuteamos." Reflects social dynamics and formality levels.',
    grammarRules: 'Regular -ar verb. Reflexive form "tutearse" means to address each other informally.',
    commonness: 'Moderately common, culturally significant',
    fixedExpression: null,
    state: 'new',
  },
  {
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    concept: 'estrenar',
    translation: 'to use/wear something for the first time',
    phoneticApproximation: 'ehs-treh-NAR',
    commonUsage: 'No direct English equivalent. "Voy a estrenar mis zapatos nuevos." Also used for movie premieres.',
    grammarRules: 'Regular -ar verb. "El estreno" is the noun form (premiere/first use).',
    commonness: 'Common in everyday speech',
    fixedExpression: null,
    state: 'mastered',
  },
  // French -> English
  {
    sourceLanguage: 'French',
    targetLanguage: 'English',
    concept: 'dépaysement',
    translation: 'the feeling of being in a foreign country / disorientation from being somewhere new',
    phoneticApproximation: 'day-pay-ez-MAHN',
    commonUsage: 'Can be positive (refreshing change of scenery) or negative (homesickness). "Le dépaysement total en arrivant au Japon."',
    grammarRules: 'Masculine noun (le dépaysement). Derived from "pays" (country) with prefix "dé-".',
    commonness: 'Moderately common, often cited as untranslatable',
    fixedExpression: null,
    state: 'familiar',
  },
  {
    sourceLanguage: 'French',
    targetLanguage: 'English',
    concept: 'bricolage',
    translation: 'DIY / tinkering / odd jobs around the house',
    phoneticApproximation: 'bree-koh-LAHZH',
    commonUsage: 'Very common in France where DIY culture is strong. "Je fais du bricolage ce weekend." Magasin de bricolage = hardware store.',
    grammarRules: 'Masculine noun (le bricolage). "Bricoler" is the verb form, "bricoleur" the person.',
    commonness: 'Very common',
    fixedExpression: null,
    state: 'mastered',
  },
  {
    sourceLanguage: 'French',
    targetLanguage: 'English',
    concept: 'flâner',
    translation: 'to stroll aimlessly / to wander without purpose',
    phoneticApproximation: 'flah-NAY',
    commonUsage: 'Distinctly Parisian concept. "J\'aime flâner dans les rues de Paris." More leisurely than just walking.',
    grammarRules: 'Regular -er verb. "Un flâneur" is the person who strolls, a concept popularized by Baudelaire.',
    commonness: 'Common in literary and everyday French',
    fixedExpression: null,
    state: 'new',
  },
  // German -> English
  {
    sourceLanguage: 'German',
    targetLanguage: 'English',
    concept: 'Feierabend',
    translation: 'the end of the workday / time after work',
    phoneticApproximation: 'FY-er-ah-bent',
    commonUsage: 'Deeply cultural concept. "Ich mache Feierabend!" (I\'m clocking off!). Implies a clear boundary between work and personal time.',
    grammarRules: 'Masculine noun (der Feierabend). Compound of "Feier" (celebration) + "Abend" (evening).',
    commonness: 'Extremely common in daily German',
    fixedExpression: null,
    state: 'learning',
  },
  {
    sourceLanguage: 'German',
    targetLanguage: 'English',
    concept: 'Fernweh',
    translation: 'longing for distant places / wanderlust',
    phoneticApproximation: 'FERN-vay',
    commonUsage: 'Opposite of Heimweh (homesickness). "Ich habe Fernweh" = I long to travel. Common in travel contexts.',
    grammarRules: 'Neuter noun (das Fernweh). Compound: "fern" (far) + "Weh" (ache/pain).',
    commonness: 'Common, especially among younger Germans',
    fixedExpression: null,
    userNotes: 'Love this word — the opposite of homesickness. Very relatable.',
    exampleSentence: 'Seit dem letzten Urlaub habe ich ständig Fernweh. — Since the last vacation, I constantly have wanderlust.',
    state: 'mastered',
  },
  {
    sourceLanguage: 'German',
    targetLanguage: 'English',
    concept: 'Verschlimmbessern',
    translation: 'to make something worse by trying to improve it',
    phoneticApproximation: 'fer-SHLIM-beh-sern',
    commonUsage: 'Humorous but widely used. "Er hat die Präsentation verschlimmbessert." Perfect for describing over-engineering.',
    grammarRules: 'Regular verb. Compound of "verschlimmern" (worsen) + "verbessern" (improve). Past participle: verschlimmbessert.',
    commonness: 'Moderately common, humorous register',
    fixedExpression: null,
    state: 'new',
  },
  // Italian -> English
  {
    sourceLanguage: 'Italian',
    targetLanguage: 'English',
    concept: 'abbiocco',
    translation: 'the drowsiness you feel after eating a big meal',
    phoneticApproximation: 'ah-bee-OH-koh',
    commonUsage: 'Very relatable concept. "Ho un abbiocco terribile dopo quel pranzo." Common after big Italian lunches.',
    grammarRules: 'Masculine noun (l\'abbiocco). Informal/colloquial register.',
    commonness: 'Common in informal Italian',
    fixedExpression: null,
    state: 'new',
  },
  {
    sourceLanguage: 'Italian',
    targetLanguage: 'English',
    concept: 'arrangiarsi',
    translation: 'to make do / to get by with what you have',
    phoneticApproximation: 'ah-rahn-JAR-see',
    commonUsage: 'Core Italian cultural concept. "In Italia bisogna arrangiarsi." Implies resourcefulness and adaptability.',
    grammarRules: 'Reflexive -are verb. Irregular: mi arrangio, ti arrangi, si arrangia...',
    commonness: 'Very common, culturally defining',
    fixedExpression: null,
    state: 'mastered',
  },
  // Portuguese -> English
  {
    sourceLanguage: 'Portuguese',
    targetLanguage: 'English',
    concept: 'saudade',
    translation: 'a deep longing for something or someone absent',
    phoneticApproximation: 'sow-DAH-djee',
    commonUsage: 'Perhaps the most famous untranslatable word. "Tenho saudade de casa." Goes beyond mere nostalgia — implies love and melancholy.',
    grammarRules: 'Feminine noun (a saudade). Can be plural: "saudades". "Matar saudades" = to catch up with someone missed.',
    commonness: 'Extremely common, central to Portuguese/Brazilian identity',
    fixedExpression: null,
    exampleSentence: 'Tenho muita saudade dos meus amigos no Brasil. — I deeply miss my friends in Brazil.',
    state: 'new',
  },
  // Japanese -> English
  {
    sourceLanguage: 'Japanese',
    targetLanguage: 'English',
    concept: 'komorebi',
    translation: 'sunlight filtering through leaves',
    phoneticApproximation: 'koh-moh-REH-bee',
    commonUsage: 'Poetic term describing dappled light in forests. Used in literature and nature descriptions.',
    grammarRules: 'Noun (木漏れ日). Compound: 木 (tree) + 漏れ (leak) + 日 (sun/light).',
    commonness: 'Common in literary and poetic contexts',
    fixedExpression: null,
    state: 'new',
  },
  {
    sourceLanguage: 'Japanese',
    targetLanguage: 'English',
    concept: 'wabi-sabi',
    translation: 'finding beauty in imperfection and transience',
    phoneticApproximation: 'WAH-bee SAH-bee',
    commonUsage: 'Aesthetic and philosophical concept. Central to Japanese art, design, and worldview. A cracked teacup is wabi-sabi.',
    grammarRules: 'Noun compound (侘寂). 侘 (wabi) = rustic simplicity, 寂 (sabi) = beauty of aging.',
    commonness: 'Well-known concept, used globally in design/philosophy',
    fixedExpression: null,
    state: 'mastered',
  },
]

async function seed() {
  console.log(`Seeding database for user: ${SEED_EMAIL}`)

  // Find user by email
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, SEED_EMAIL),
  })

  if (!user) {
    console.error(`User with email "${SEED_EMAIL}" not found in database.`)
    console.error('Make sure you have signed in at least once before seeding.')
    process.exit(1)
  }

  console.log(`Found user: ${user.name ?? user.email} (id: ${user.id})`)

  // Clear existing concepts for this user
  const deleted = await db
    .delete(conceptsTable)
    .where(eq(conceptsTable.userId, user.id))
    .returning()
  console.log(`Cleared ${deleted.length} existing concepts`)

  // Insert seed concepts with staggered dates
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i]!
    const daysAgo = concepts.length - i // oldest first
    const createdAt = new Date(now - daysAgo * DAY)

    await db.insert(conceptsTable).values({
      userId: user.id,
      sourceLanguage: concept.sourceLanguage,
      targetLanguage: concept.targetLanguage,
      concept: concept.concept,
      translation: concept.translation,
      phoneticApproximation: concept.phoneticApproximation,
      commonUsage: concept.commonUsage,
      grammarRules: concept.grammarRules,
      commonness: concept.commonness,
      fixedExpression: concept.fixedExpression,
      userNotes: concept.userNotes ?? null,
      exampleSentence: concept.exampleSentence ?? null,
      state: concept.state,
      createdAt,
    })
  }

  console.log(`Inserted ${concepts.length} concepts across ${new Set(concepts.map(c => `${c.sourceLanguage}->${c.targetLanguage}`)).size} language pairs`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
