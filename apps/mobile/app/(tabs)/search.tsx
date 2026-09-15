import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SearchHit } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { useCourse } from '../../src/course';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

/**
 * Search across the whole course.
 *
 * Deferred rather than debounced: the search itself is a scan over 4 768 items
 * and React can drop intermediate renders while someone is still typing, which
 * keeps the field responsive without guessing at a delay.
 */
export default function SearchScreen() {
  const { repository } = useCourse();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const hits = useMemo(
    () => repository.search(deferred, { limit: 40 }),
    [repository, deferred],
  );

  return (
    <Screen>
      <Text style={styles.title}>{strings.tabSearch}</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={strings.searchPlaceholder}
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {deferred.trim().length < 2 ? (
        <Text style={styles.hint}>{strings.searchEmpty}</Text>
      ) : hits.length === 0 ? (
        <Text style={styles.hint}>{strings.searchNoResults}</Text>
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(hit: SearchHit) => (hit.kind === 'vocabulary' ? hit.item.id : hit.topic.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item: hit }) => <Hit hit={hit} />}
        />
      )}
    </Screen>
  );
}

function Hit({ hit }: { hit: SearchHit }) {
  if (hit.kind === 'grammar') {
    return (
      <Card style={styles.hitCard}>
        <View style={styles.hitHeader}>
          <Text style={styles.term}>{hit.topic.title}</Text>
          <Text style={styles.level}>{hit.topic.level}</Text>
        </View>
        {hit.topic.summary ? <Text style={styles.meaning}>{hit.topic.summary}</Text> : null}
      </Card>
    );
  }

  const { item } = hit;
  const article = item.metadata.article;
  // An approximated level is labelled as one. The corpus distinguishes a level a
  // word list states from one inferred from a tier, and so does the interface.
  const approximate = item.levelProvenance.kind === 'approximated';

  return (
    <Card style={styles.hitCard}>
      <View style={styles.hitHeader}>
        <Text style={styles.term}>{article ? `${article} ${item.term}` : item.term}</Text>
        {item.level ? (
          <Text style={styles.level}>
            {approximate ? strings.approxLevel(item.level) : item.level}
          </Text>
        ) : null}
      </View>
      <Text style={styles.meaning}>{item.translation}</Text>
      {item.example ? <Text style={styles.example}>{item.example}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typeScale.display, color: palette.text, paddingVertical: spacing.md },
  input: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: palette.text,
  },
  hint: { ...typeScale.caption, color: palette.textMuted, paddingVertical: spacing.md },
  list: { paddingVertical: spacing.md, paddingBottom: spacing.xl },
  hitCard: { marginBottom: spacing.sm, gap: spacing.xs },
  hitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  term: { ...typeScale.heading, color: palette.text, flexShrink: 1 },
  level: { ...typeScale.label, color: palette.textMuted },
  meaning: { ...typeScale.body, color: palette.text },
  example: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
});
