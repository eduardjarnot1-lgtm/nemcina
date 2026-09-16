import { Text, View } from 'react-native';
import type { SaveStatus } from '../answerPersistence';
import { strings } from '../strings';
import { palette, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export function AnswerSaveStatus({ status, retry }: { status: SaveStatus; retry: () => Promise<void> }) {
  if (status === 'saved') return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: palette.text }}>
        {status === 'saving' ? strings.savingAnswer : strings.saveAnswerFailed}
      </Text>
      {status === 'error' ? (
        <PrimaryButton label={strings.retrySave} onPress={() => { void retry(); }} />
      ) : null}
    </View>
  );
}
