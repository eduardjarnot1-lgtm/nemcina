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
  grammarRules: 'Rules',
  grammarExamples: 'Examples',
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
  backToLessons: 'Back to lessons',

  profileProgress: 'Progress',
  profileReset: 'Delete my progress',
  profileResetExplain:
    'Removes every answer stored on this device. The course content is untouched.',
  profileResetConfirm: 'Delete everything?',
  profileResetCancel: 'Cancel',
  welcomeTitle: 'Němčina',
  welcomeLead: 'German vocabulary and grammar from published word lists and coursebooks. Nothing in the course is machine-generated.',
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
    'Vocabulary and grammar come from published word lists and coursebooks, credited in ZDROJE.md. Nothing in the course is machine-generated.',

  levelLabel: (level: string) => level,
  approxLevel: (level: string) => `${level} (approx.)`,
} as const;
