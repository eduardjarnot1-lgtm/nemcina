import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CEFR_LEVELS, clusterStatus, vocabularyTopicProgress, type CefrLevel } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { TopicCard } from '../../src/components/TopicCard';
import { ClusterRow } from '../../src/components/ClusterRow';
import { Reveal } from '../../src/components/Reveal';
import { Mascot } from '../../src/components/Mascot';
import { Selectable } from '../../src/components/Selectable';
import { track } from '../../src/analytics';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { usePreferences } from '../../src/preferences';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

/**
 * Browsing the course (§26, mode B).
 *
 * Three steps rather than two: level, then topic, then the lesson inside it.
 * The middle step is the one that was missing. Before, picking A2 handed over
 * fifty-seven lessons cut from the level in teaching order, and since almost no
 * topic word carries a frequency rank that order came out alphabetical — so
 * "A2, lesson 1" was *meinen, Liebe, Geld, finden, Ordnung…*. A learner cannot
 * choose to study airports from a list like that, because the list does not
 * know what airports are.
 *
 * Choosing is kept for the learner who arrives knowing what they need ("I have
 * a doctor's appointment"). The learner who just wants to carry on is served by
 * the recommendation on the home screen instead, and both move the same
 * progress.
 */
export default function LessonsScreen() {
  const router = useRouter();
  const { topicsByLevel } = useCourse();
  const { records } = useProgress();
  const { preferences } = usePreferences();

  const levels = useMemo(
    () => CEFR_LEVELS.filter((level) => (topicsByLevel.get(level)?.length ?? 0) > 0),
    [topicsByLevel],
  );

  // Opening on the placed level rather than on A1: a learner placed at B1 who
  // has to scroll past two levels every time has been placed for nothing.
  const placed = preferences.startingLevel as CefrLevel | undefined;
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const activeLevel = (level && levels.includes(level) ? level : null)
    ?? (placed && levels.includes(placed) ? placed : levels[0] ?? null);

  const topics = useMemo(
    () => (activeLevel ? topicsByLevel.get(activeLevel) ?? [] : []),
    [topicsByLevel, activeLevel],
  );

  // Progress for every topic at this level, in one pass over the records.
  const progressByTopic = useMemo(() => {
    const all = topics.flatMap((topic) => topic.clusters);
    const rolled = vocabularyTopicProgress(all, records);
    return new Map(rolled.map((entry) => [`${entry.level}/${entry.subcategory}`, entry]));
  }, [topics, records]);

  const topic = openTopic ? topics.find((entry) => entry.id === openTopic) ?? null : null;

  if (topic) {
    return (
      <Screen>
        <Pressable onPress={() => setOpenTopic(null)} style={styles.back}>
          <Text style={styles.backLabel}>← {strings.backToTopics}</Text>
        </Pressable>
        <Text style={styles.title}>{topic.title}</Text>
        <Text style={styles.subtitle}>
          {topic.level} · {strings.topicLessons(topic.clusters.length)} · {topic.wordCount} words
        </Text>
        <FlatList
          data={topic.clusters}
          keyExtractor={(cluster) => cluster.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ClusterRow
              cluster={item}
              index={index}
              status={clusterStatus(item, records)}
              onPress={() => router.push(`/session/${encodeURIComponent(item.id)}`)}
            />
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{strings.tabLessons}</Text>

      <Reveal index={0} style={styles.companionRow}>
        <Mascot pose="pleased" size="small" />
        <Text style={styles.companionLine}>{strings.chooseTopic}</Text>
      </Reveal>

      <Reveal index={1} style={styles.groupRow}>
        <FlatList
          horizontal
          data={levels}
          keyExtractor={(entry) => entry}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupList}
          renderItem={({ item }) => (
            <Choice
              label={item}
              active={item === activeLevel}
              onPress={() => { setLevel(item); setOpenTopic(null); }}
            />
          )}
        />
      </Reveal>

      <FlatList
        data={topics}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const rolled = progressByTopic.get(item.id);
          return (
            <TopicCard
              title={item.title}
              level={item.level}
              mastered={rolled?.mastered ?? 0}
              total={item.wordCount}
              lessons={item.clusters.length}
              completion={rolled?.completion ?? 0}
              index={index}
              once={`topic-${item.id}`}
              onPress={() => {
                track({ name: 'topic_selected', level: item.level, topic: item.subcategory });
                setOpenTopic(item.id);
              }}
            />
          );
        }}
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
  title: { ...typeScale.display, color: palette.text, paddingTop: spacing.md },
  subtitle: { ...typeScale.caption, color: palette.textMuted, paddingBottom: spacing.md },
  back: { paddingTop: spacing.md },
  backLabel: { ...typeScale.label, color: palette.accent },
  groupRow: { marginBottom: spacing.sm, marginTop: spacing.sm },
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
