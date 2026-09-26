import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lessonStatus, type Lesson } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { LessonRow } from '../../src/components/LessonRow';
import { Reveal } from '../../src/components/Reveal';
import { Mascot } from '../../src/components/Mascot';
import { Selectable } from '../../src/components/Selectable';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { usePreferences } from '../../src/preferences';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

type Route = 'level' | 'topic';

/**
 * Browsing the course.
 *
 * Two routes through the same cards, because learners arrive with two different
 * questions: "what should I know at A2" and "I need the words for a doctor's
 * appointment". Neither is a sub-case of the other.
 */
export default function LessonsScreen() {
  const router = useRouter();
  const { levelLessons, topicLessons } = useCourse();
  const { records } = useProgress();
  const { preferences } = usePreferences();
  const [route, setRoute] = useState<Route>('level');
  const [group, setGroup] = useState<string | null>(null);

  const lessons = route === 'level' ? levelLessons : topicLessons;

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const lesson of lessons) if (!seen.has(lesson.groupId)) seen.set(lesson.groupId, lesson.groupTitle);
    return [...seen.entries()].map(([id, title]) => ({ id, title }));
  }, [lessons]);

  // Opening on the placed level rather than on A1: a learner placed at B1 who
  // has to scroll past two levels every time has been placed for nothing.
  const placed = preferences.startingLevel?.toLowerCase() ?? null;
  const preferred = route === 'level' && placed && groups.some((entry) => entry.id === placed)
    ? placed
    : groups[0]?.id ?? null;
  const active = group && groups.some((entry) => entry.id === group) ? group : preferred;

  const shown = useMemo(
    () => lessons.filter((lesson) => lesson.groupId === active),
    [lessons, active],
  );

  return (
    <Screen>
      <Text style={styles.title}>{strings.tabLessons}</Text>

      <Reveal index={0} style={styles.companionRow}>
        <Mascot pose="pleased" size="small" />
        <Text style={styles.companionLine}>{strings.lessonsCompanion}</Text>
      </Reveal>

      <Reveal index={1} style={styles.switcher}>
        <Choice label={strings.browseByLevel} active={route === 'level'}
          onPress={() => { setRoute('level'); setGroup(null); }} />
        <Choice label={strings.browseByTopic} active={route === 'topic'}
          onPress={() => { setRoute('topic'); setGroup(null); }} />
      </Reveal>

      <Reveal index={2} style={styles.groupRow}>
        <FlatList
          horizontal
          data={groups}
          keyExtractor={(entry) => entry.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupList}
          renderItem={({ item }) => (
            <Choice
              label={item.title}
              active={item.id === active}
              onPress={() => setGroup(item.id)}
            />
          )}
        />
      </Reveal>

      <FlatList
        data={shown}
        keyExtractor={(lesson: Lesson) => lesson.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <LessonRow
            lesson={item}
            index={index}
            status={lessonStatus(item, records)}
            onPress={() => router.push(`/session/${encodeURIComponent(item.id)}`)}
          />
        )}
      />
    </Screen>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Selectable selected={active} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
    </Selectable>
  );
}

const styles = StyleSheet.create({
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  companionLine: { ...typeScale.caption, color: palette.textMuted, flex: 1 },
  title: { ...typeScale.display, color: palette.text, paddingVertical: spacing.md },
  switcher: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  groupRow: { marginBottom: spacing.sm },
  groupList: { gap: spacing.sm, paddingRight: spacing.md },
  list: { paddingBottom: spacing.xl },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  choiceActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  choiceLabel: { ...typeScale.label, color: palette.textMuted },
  choiceLabelActive: { color: '#ffffff' },
});
