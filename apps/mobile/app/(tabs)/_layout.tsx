import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { palette } from '../../src/theme';
import { strings } from '../../src/strings';

/** A glyph rather than an icon font: one fewer dependency for four tabs. */
const glyph = (character: string) =>
  function TabGlyph({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{character}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: strings.tabLearn, tabBarIcon: glyph('◎') }}
      />
      <Tabs.Screen
        name="lessons"
        options={{ title: strings.tabLessons, tabBarIcon: glyph('☰') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: strings.tabSearch, tabBarIcon: glyph('⌕') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: strings.tabProfile, tabBarIcon: glyph('☺') }}
      />
    </Tabs>
  );
}
