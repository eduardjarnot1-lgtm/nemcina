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

  questionRecognise: 'What does this mean?',
  questionChoice: 'Choose the right meaning',
  questionRecall: 'Write the German word',
  questionTyping: 'Write it with its article',
  questionContext: 'Fill the gap',
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
  profileSources: 'Content sources',
  profileSourcesExplain:
    'Vocabulary and grammar come from published word lists and coursebooks, credited in ZDROJE.md. Nothing in the course is machine-generated.',

  levelLabel: (level: string) => level,
  approxLevel: (level: string) => `${level} (approx.)`,
} as const;
