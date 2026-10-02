import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  clusterStatus, isDue, isComeback, levelsFrom, mascotLine, recommendCluster, totals,
  type CefrLevel,
} from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { CoachPanel } from '../../src/components/CoachPanel';
import { Mascot } from '../../src/components/Mascot';
import { Reveal } from '../../src/components/Reveal';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { usePreferences } from '../../src/preferences';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

/**
 * The first screen.
 *
 * One decision: what should this person do right now. Reviews that are due come
 * first — letting them pile up is how a spaced-repetition app turns into a
 * backlog nobody opens — and otherwise it is the next unfinished lesson.
 */
export default function LearnScreen() {
  const router = useRouter();
  const { clusters, topicsById } = useCourse();
  const { records, ready } = useProgress();
  const { preferences, ready: preferencesReady } = usePreferences();

  // Clusters below where the learner was placed are not offered as "next": the
  // placement test exists precisely so nobody is sent back to them.
  const offered = useMemo(() => {
    const from = preferences.startingLevel as CefrLevel | undefined;
    if (!from) return clusters;
    const allowed = new Set(levelsFrom(from));
    const filtered = clusters.filter((cluster) => allowed.has(cluster.level));
    return filtered.length > 0 ? filtered : clusters;
  }, [clusters, preferences.startingLevel]);

  const summary = useMemo(() => totals(records.values()), [records]);

  /**
   * Someone coming back after a gap, and only then.
   *
   * From the latest review the learner actually has — not a stored "last seen"
   * flag, which would greet a fresh install as a returning friend. Two days is
   * the threshold: one missed evening is not an absence. He says nothing about
   * the gap, because they know, and they came back anyway.
   */
  const comeback = useMemo(() => {
    const latest = [...records.values()]
      .reduce((most, record) => Math.max(most, record.lastReviewed), 0);
    if (!latest || !isComeback(latest, Date.now())) return null;
    return mascotLine('comeback');
  }, [records]);
  /**
   * The recommended lesson (§26, mode A).
   *
   * A topic the learner has started outranks a new one, so the app does not
   * open a fifth half-finished subject. Everything the learner needs to decide
   * is on the card: the level, the topic, the lesson's own name and three of
   * its words — enough to know it is about airports before opening it.
   */
  const next = useMemo(() => recommendCluster(offered, records), [offered, records]);
  const nextStatus = useMemo(
    () => (next ? clusterStatus(next, records) : null),
    [next, records],
  );
  const nextTopic = next ? topicsById.get(`${next.level}/${next.subcategory}`) ?? null : null;

  /**
   * The single recommended action, and where it goes.
   *
   * Reviews first — they are the words about to be forgotten — then the lesson
   * the course is actually on. The cards below show the same two things with
   * their context intact; the button is the shortcut, not a fourth route. Three
   * primary buttons on one screen is three recommendations, which is none.
   */
  const dueCount = useMemo(
    () => [...records.values()].filter((record) => isDue(record)).length,
    [records],
  );

  const primary = useMemo(() => {
    if (dueCount > 0) {
      return { label: strings.continueLesson, go: () => router.push('/session/review') };
    }
    if (next) {
      return {
        label: nextStatus?.started ? strings.continueLesson : strings.startLesson,
        go: () => router.push(`/session/${encodeURIComponent(next.id)}`),
      };
    }
    return { label: strings.homeStart, go: () => router.push('/lessons') };
  }, [dueCount, next, nextStatus?.started, router]);


  /**
   * What Milo says on an ordinary day: the learner's own position, in a
   * sentence. Not a random greeting — a number they can act on.
   */
  const { width } = useWindowDimensions();

  const heroLine = useMemo(() => (
    dueCount > 0
      ? strings.homeDue(dueCount)
      : summary.learned > 0 ? strings.homeCaughtUp : strings.homeFirst
  ), [dueCount, summary.learned]);

  // The welcome flow is the app's front door, not a dialog over it.
  if (preferencesReady && !preferences.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The screen assembles top-down, then stops. The order is the order
            of importance, so attention lands on the one thing to do next
            rather than on whatever moved last. */}
        {/* Milo stands beside the app's name and the one thing to do next, at
            hero size. This is the screen where he is the thing you look at;
            everywhere else he is beside something you are reading.

            The line changes with the situation and never with the day: coming
            back after a gap he says so, otherwise he says nothing at all and
            is simply there. A greeting every single morning is a greeting you
            stop reading by Thursday. */}
        <Reveal index={0}>
          <View style={styles.hero}>
            <Mascot
              pose={comeback ? 'greet' : 'pleased'}
              // He gives up size before the sentence and the button do. At the
              // full 200px a 390px phone had only ~170px left for the text and
              // "Start learning" wrapped onto two lines.
              size={width >= 430 ? 'hero' : 'large'}
              style={styles.heroFigure}
            />
            <View style={styles.heroText}>
              <Text style={styles.appName}>{strings.appName}</Text>
              {comeback ? (
                <Text style={styles.heroLine}>{comeback.text}</Text>
              ) : (
                <Text style={styles.heroLine}>{heroLine}</Text>
              )}
              <PrimaryButton label={primary.label} onPress={primary.go} />
            </View>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.statRow}>
          <Stat label={strings.wordsLearned} value={summary.learned} />
          <Stat label={strings.wordsMastered} value={summary.mastered} />
          <Stat label={strings.dueToday} value={dueCount} />
        </Reveal>

        <Reveal index={2}>
        {dueCount > 0 ? (
          <Card
            tone="accent"
            style={styles.block}
            onPress={() => router.push('/session/review')}
          >
            <Text style={styles.blockTitle}>{strings.dueToday}</Text>
            <Text style={styles.blockMeta}>{strings.itemsInLesson(dueCount)}</Text>
          </Card>
        ) : (
          <Card style={styles.block}>
            <Text style={styles.blockMeta}>{strings.dueNone}</Text>
          </Card>
        )}
        </Reveal>

        <Reveal index={3}>
          <CoachPanel />
        </Reveal>

        <Reveal index={4}>
        {next && nextStatus ? (
          <Card
            style={styles.block}
            onPress={() => router.push(`/session/${encodeURIComponent(next.id)}`)}
          >
            <Text style={styles.blockKicker}>
              {strings.recommended} · {next.level}
              {nextTopic && !next.name.startsWith(nextTopic.title)
                ? ` · ${nextTopic.title.toUpperCase()}` : ''}
            </Text>
            <Text style={styles.blockTitle}>{next.name}</Text>
            <Text style={styles.blockMeta}>
              {strings.itemsInLesson(nextStatus.total)} · {strings.lessonMinutes(nextStatus.total)}
              {next.preview.length > 0 ? ` · ${next.preview.join(' · ')}` : ''}
            </Text>
            <ProgressBar value={nextStatus.completion} />
          </Card>
        ) : ready ? (
          <Card style={styles.block}>
            <Text style={styles.blockMeta}>{strings.allLessonsDone}</Text>
          </Card>
        ) : null}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // He gives up width before the text does: on a narrow phone the sentence and
  // the button matter more than how big he is.
  heroFigure: { flexShrink: 1 },
  heroText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  heroLine: { ...typeScale.body, color: palette.textSecond, lineHeight: 22 },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  appName: { ...typeScale.display, color: palette.text },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { ...typeScale.title, color: palette.text },
  statLabel: { ...typeScale.caption, color: palette.textMuted },
  block: { gap: spacing.sm },
  blockKicker: { ...typeScale.label, color: palette.accent, letterSpacing: 0.5 },
  blockTitle: { ...typeScale.heading, color: palette.text },
  blockMeta: { ...typeScale.caption, color: palette.textMuted },
});
