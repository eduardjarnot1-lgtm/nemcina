/**
 * Every word the interface says, in one file.
 *
 * The app teaches German to speakers of some other language, and which other
 * language is a product decision, not a constant (§20). Keeping the strings in
 * one table means adding Czech is a second table rather than a hunt through
 * every screen. There is no i18n library yet because there is nothing to choose
 * between with one language in the file — the seam is what matters now.
 */

export const strings = {
  appName: 'Němčina',

  tabLearn: 'Learn',
  tabLessons: 'Lessons',
  tabGrammar: 'Grammar',
  tabSearch: 'Search',
  tabProfile: 'Profile',

  loading: 'Loading the course…',

  continueLesson: 'Continue',
  startLesson: 'Start',
  nextLesson: 'Next lesson',
  lessonOf: (index: number, total: number) => `Lesson ${index} of ${total}`,
  itemsInLesson: (count: number) => `${count} words`,
  allLessonsDone: 'Every lesson is finished. Reviews keep coming back on schedule.',

  dueToday: 'Due now',
  dueNone: 'Nothing is due — good time for a new lesson.',
  wordsLearned: 'Learned',
  wordsMastered: 'Mastered',
  streak: 'Day streak',

  browseByLevel: 'By level',
  browseByTopic: 'By topic',

  searchPlaceholder: 'German or English…',
  searchEmpty: 'Type at least two letters.',
  searchNoResults: 'Nothing found.',
  searchApproxLevel: 'approx.',

  grammarTopics: (count: number) => `${count} topics`,
  grammarExercises: (count: number) => `${count} exercises`,
  b2GrammarTitle: 'B2 Grammar',
  b2GrammarBanner: 'B2 Grammar — its own section',
  b2GrammarBannerHint: (topics: number, exercises: number) =>
    `${topics} topics written for this app · ${exercises} exercises`,
  b2GrammarIntro:
    'Every topic gives you the rule in German and in English, four worked examples from the '
    + 'source document, and exercises. Exercises built on a document sentence are marked as '
    + 'such; the rest are labelled as practice.',
  b2GrammarEmpty: 'B2 grammar is not built yet.',
  // The grammar page's own section headings. Each one is the whole message:
  // the colour beside it groups, it never informs.
  grammarWatchOut: 'Watch out',
  grammarInShort: 'In short',
  grammarForms: 'The forms',
  grammarShape: 'How it is built',
  grammarVersus: (left: string, right: string) => `${left} or ${right}?`,
  grammarCommonMistake: 'Common mistake',
  grammarShowMistake: 'Show the common mistake',
  // The tick and cross are never the only signal; these name them.
  grammarRight: 'Correct',
  grammarWrong: 'Incorrect',
  grammarException: 'Exception',
  grammarHowItWorks: 'How it works',
  grammarMoreDetail: 'More detail',
  grammarShowMore: (n: number) => `Show ${n} more`,
  grammarShowLess: 'Show less',
  grammarTopicsIn: (n: number) => `${n} topics`,
  grammarRules: 'Rules',
  grammarExamples: 'Examples',
  grammarLegend: 'What the colours mark',
  grammarLegendTaught: 'the form taught here',
  grammarIsolateHint: 'Dims the rest of the sentence so the pattern stands alone',
  grammarPractise: 'Practise',
  grammarSource: 'From',
  grammarNoExercises: 'This topic has no exercises yet.',
  grammarWrittenForPractice: 'written for practice, not from the source',
  grammarDone: 'Topic finished',

  questionRecognise: 'What does this mean?',
  questionChoice: 'Choose the right meaning',
  questionRecall: 'Write the German word',
  questionTyping: 'Write it with its article',
  questionContext: 'Fill the gap',
  questionFill: 'Complete the sentence',
  questionChoose: 'Choose the right form',
  questionTransform: 'Rewrite the sentence',
  questionReorder: 'Put it in the right order',
  questionCorrect: 'Correct the mistake',
  answerPlaceholder: 'Your answer',
  check: 'Check',
  next: 'Continue',
  showHint: 'Hint',
  skip: 'Skip',

  correct: 'Correct',
  almost: 'Almost — check the spelling',
  wrong: 'Not quite',
  theAnswerWas: 'Answer:',
  comesBackLater: 'You will see this one again.',

  sessionDone: 'Session finished',
  sessionAccuracy: (percent: number) => `${percent}% right first time`,
  sessionStudied: (count: number) => `${count} words studied`,
  sessionPerfect: 'Perfect session',
  sessionPerfectNote: 'Every answer right first time.',
  feedbackSetting: 'Vibration',
  hapticsOn: 'On',
  hapticsOff: 'Off',
  backToLessons: 'Back to lessons',

  levelTitle: 'Level',
  levelProgress: (into: number, span: number) => `${into} / ${span} XP`,
  // Shown only when it is true, and it says what is left rather than urging.
  levelAlmost: (xp: number) => `${xp} XP to the next level`,
  streakBest: (days: number) => `best ${days}`,
  combo: (run: number) => `${run}\u00D7 in a row`,
  achievementsTitle: 'Achievements',
  achievementsEarned: (count: number, total: number) => `${count} of ${total}`,
  achievementNames: {
    'first-word': 'First word learned',
    'words-50': '50 words',
    'words-250': '250 words',
    'words-1000': '1000 words',
    'mastered-50': '50 words mastered',
    'streak-3': 'Three days running',
    'streak-7': 'A full week',
    'streak-30': 'Thirty days',
    'grammar-started': 'First grammar exercise',
    'accuracy-90': '90% right first time',
    'level-5': 'Level 5',
    'level-10': 'Level 10',
  } as Record<string, string>,

  profileProgress: 'Progress',
  profileReset: 'Delete my progress',
  profileResetExplain:
    'Removes every answer stored on this device. The course content is untouched.',
  profileResetConfirm: 'Delete everything?',
  profileResetCancel: 'Cancel',
  welcomeTitle: 'Němčina',
  welcomeLead: 'Vocabulary written for this course. Grammar from published coursebooks, credited on every topic.',
  welcomeGoalTitle: 'How much is a session?',
  welcomeGoalNote: 'You can change this later.',
  goalWords: (count: number) => `${count} words`,
  goalShort: 'A few minutes',
  goalNormal: 'A steady pace',
  goalLong: 'A proper sitting',
  welcomeLevelTitle: 'Where should you start?',
  welcomeLevelNote:
    'A short test places you. It takes about twenty questions and you can skip it.',
  welcomeTakeTest: 'Take the placement test',
  welcomeSkipTest: 'Start at the beginning',

  placementTitle: 'Placement',
  placementProgress: (index: number, max: number) => `${index} of up to ${max}`,
  placementDontKnow: "I don't know",
  placementResultTitle: 'You start at',
  placementResultBracketed: 'Two levels agreed on this, so it should be about right.',
  placementResultPartial: 'You half-knew this level, which is the useful place to be.',
  placementResultExhausted: 'The test ran short, so this is a rough placement.',
  placementScore: (correct: number, asked: number) => `${correct} of ${asked} right`,
  placementBegin: 'Start learning',
  placementRetake: 'Take the placement test again',
  placementNoContent: 'There is not enough vocabulary to place you. Starting at A1.',
  startingLevel: 'Starting level',
  dailyGoal: 'Session length',

  coachTitle: 'Coach',
  coachAsk: 'Ask the coach',
  coachThinking: 'Thinking…',
  coachRemaining: (left: number, limit: number) => `${left} of ${limit} left today`,
  coachNoModel:
    'No coach model is configured for this build. Everything here is worked out on this device from your own answers.',
  coachSignedOut:
    'Sign in to ask the coach. Everything here is worked out on this device from your own answers.',
  coachFromYourRecords: 'From your own answers',

  adviceNothingYet: 'Nothing studied yet. Start a lesson and this fills in.',
  adviceReviewsDue: (due: number) => `${due} ${due === 1 ? 'word is' : 'words are'} due for review.`,
  adviceWeakItems: (weak: number, worst: string) =>
    `${weak} ${weak === 1 ? 'word keeps' : 'words keep'} coming back wrong — ${worst} most of all.`,
  adviceKeepStreak: (days: number) => `${days} days in a row. Today has not been studied yet.`,
  adviceAccuracyLow: (percent: number) =>
    `${percent}% right first time lately. Fewer new words and more review would help.`,
  adviceAccuracyHigh: (percent: number) =>
    `${percent}% right first time lately. There is room for more new material.`,
  adviceNewMaterial: (learned: number, remaining: number) =>
    `${learned} learned, ${remaining} not yet seen. Nothing is owed, so take on something new.`,
  adviceGrammarUntouched: (topics: number) =>
    `${topics} grammar topics and none opened yet.`,

  accountTitle: 'Account',
  accountSignedInAs: 'Signed in as',
  accountEmail: 'Email',
  accountPassword: 'Password',
  accountSignIn: 'Sign in',
  accountRegister: 'Create an account',
  accountSignOut: 'Sign out',
  accountSwitchToRegister: 'No account yet? Create one',
  accountSwitchToSignIn: 'Already have an account? Sign in',
  accountSyncNow: 'Sync now',
  accountSyncing: 'Syncing…',
  accountNeverSynced: 'Not synced yet',
  accountSyncResult: (pushed: number, pulled: number) =>
    `Sent ${pushed}, received ${pulled}.`,
  accountNotConfigured:
    'This build has no sync server, so progress stays on this device. Accounts and cross-device sync work once one is configured.',
  accountWhySignIn:
    'An account keeps your progress across devices. Without one everything still works and stays on this phone.',
  accountDelete: 'Delete my account',
  accountDeleteExplain:
    'Removes the account and everything stored on the server. Progress on this device is kept.',
  accountFree: 'Free',
  accountPremium: 'Premium',

  profileSources: 'Content sources',
  profileSourcesExplain:
    'The vocabulary was written for this course — no exam board list, publisher word list or dictionary. The grammar comes from published coursebooks and every topic names the one it came from. ZDROJE.md lists them all.',

  levelLabel: (level: string) => level,
  approxLevel: (level: string) => `${level} (approx.)`,
} as const;
