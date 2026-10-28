import React from 'react';
import { View, Pressable } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../../theme';

interface DividerBlockProps {
  blockId: string;
  isAnyDragging?: boolean;
  onDelete: () => void;
}

export const DividerBlock: React.FC<DividerBlockProps> = ({
  blockId,
  isAnyDragging,
  onDelete,
}) => {
  const { isDark } = useTheme();

  return (
    <View
      pointerEvents={isAnyDragging ? 'none' : 'auto'}
      nativeID={`scribex-block-${blockId}`}
      id={`scribex-block-${blockId}`}
      dataSet={{ scribexBlockId: blockId }}
      {...({ 'data-scribex-block-id': blockId } as any)}
      className="my-6 py-2 flex-row items-center justify-between group"
    >
      <View className="flex-1 h-[1px] bg-light-border/80 dark:bg-dark-border/80" />
      <Pressable
        onPress={onDelete}
        accessibilityLabel="Delete Divider"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
        className="ml-2 p-1 rounded-full opacity-40 hover:opacity-100"
      >
        <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
      </Pressable>
    </View>
  );
};

