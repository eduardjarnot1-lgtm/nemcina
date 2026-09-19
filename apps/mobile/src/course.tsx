/**
 * The course, in React.
 *
 * Building the repository and cutting 456 lessons out of 4 768 cards takes a
 * few hundred milliseconds. Doing it during the first render would show the
 * learner a white screen with no explanation, so it happens just after the first
 * frame and the screens render a loading state until it lands.
 */
import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadCourse, type Course } from './content';
import { palette, spacing, type as typeScale } from './theme';
import { strings } from './strings';

const CourseContext = createContext<Course | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    // A timeout of zero, not a direct call: it yields to the renderer so the
    // loading state is actually painted before the main thread is busy.
    const handle = setTimeout(() => setCourse(loadCourse()), 0);
    return () => clearTimeout(handle);
  }, []);

  if (!course) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.label}>{strings.loading}</Text>
      </View>
    );
  }

  return <CourseContext.Provider value={course}>{children}</CourseContext.Provider>;
}

export function useCourse(): Course {
  const course = useContext(CourseContext);
  if (!course) throw new Error('useCourse must be used inside CourseProvider');
  return course;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: palette.background,
  },
  label: { ...typeScale.caption, color: palette.textMuted },
});
