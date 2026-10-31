import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Receipt, DollarSign, Calendar, Tag, Trash2, CheckCircle2 } from 'lucide-react-native';

export interface ExpenseBlockMetadata {
  merchant?: string;
  amount?: string;
  currency?: string;
  category?: string;
  date?: string;
  status?: 'cleared' | 'pending';
}

interface ExpenseBlockProps {
  metadata?: ExpenseBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateExpense?: (updates: ExpenseBlockMetadata) => void;
}

const CURRENCIES = ['$', '€', '£', '₹'];
const CATEGORIES = ['Tech', 'Travel', 'Meals', 'Office', 'Personal'];

export const ExpenseBlock: React.FC<ExpenseBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateExpense,
}) => {
  const { isDark } = useTheme();

  const merchant = metadata?.merchant || content || 'Cloud Infrastructure Hosting';
  const amount = metadata?.amount || '49.99';
  const currency = metadata?.currency || '$';
  const category = metadata?.category || 'Tech';
  const date = metadata?.date || new Date().toISOString().split('T')[0];
  const status = metadata?.status || 'cleared';

  const [localMerchant, setLocalMerchant] = useState(merchant);
  const [localAmount, setLocalAmount] = useState(amount);

  const commitUpdates = (partial: Partial<ExpenseBlockMetadata>) => {
    onUpdateExpense?.({
      merchant: localMerchant,
      amount: localAmount,
      currency,
      category,
      date,
      status,
      ...partial,
    });
  };

  const handleCycleCurrency = () => {
    onFocus?.();
    const curIdx = CURRENCIES.indexOf(currency);
    const nextCur = CURRENCIES[(curIdx + 1) % CURRENCIES.length];
    commitUpdates({ currency: nextCur });
  };

  const handleCycleCategory = () => {
    onFocus?.();
    const curIdx = CATEGORIES.indexOf(category);
    const nextCat = CATEGORIES[(curIdx + 1) % CATEGORIES.length];
    commitUpdates({ category: nextCat });
  };

  const handleToggleStatus = () => {
    onFocus?.();
    commitUpdates({ status: status === 'cleared' ? 'pending' : 'cleared' });
  };

  const containerStyle = useMemo(() => {
    return {
      borderColor: isSelected
        ? isDark
          ? 'rgba(16, 185, 129, 0.7)'
          : 'rgba(16, 185, 129, 0.85)'
        : 'transparent',
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(16, 185, 129, 0.05)'
          : 'rgba(236, 253, 245, 0.5)'
        : isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    };
  }, [isSelected, isDark]);

  return (
    <View
      style={containerStyle}
      className="py-3 px-3.5 my-2 rounded-2xl border-2 transition-all cursor-default"
    >
      {/* Top Header: Receipt Icon + Amount + Merchant */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2.5 flex-1">
          {/* Currency Pill */}
          <Pressable
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleCycleCurrency}
            className="w-8 h-8 rounded-full bg-emerald-500/15 dark:bg-emerald-400/20 border border-emerald-500/30 items-center justify-center shadow-xs"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
            accessibilityLabel="Cycle currency symbol"
          >
            <Text className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {currency}
            </Text>
          </Pressable>

          {/* Amount Input */}
          <View className="flex-row items-center">
            <Text className="text-xl md:text-2xl font-black text-light-textPrimary dark:text-dark-textPrimary mr-0.5">
              {currency}
            </Text>
            <TextInput
              value={localAmount}
              onChangeText={(amt) => {
                setLocalAmount(amt);
                commitUpdates({ amount: amt });
              }}
              onFocus={onFocus}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
              className="text-xl md:text-2xl font-black text-light-textPrimary dark:text-dark-textPrimary outline-none py-0 w-28"
            />
          </View>

          {/* Merchant / Description */}
          <TextInput
            value={localMerchant}
            onChangeText={(m) => {
              setLocalMerchant(m);
              commitUpdates({ merchant: m });
            }}
            onFocus={onFocus}
            placeholder="Merchant / Purpose..."
            placeholderTextColor={isDark ? '#737373' : '#A3A3A3'}
            className="flex-1 text-sm md:text-base font-bold text-light-textSecondary dark:text-dark-textSecondary outline-none py-0.5 ml-2"
          />
        </View>

        {onDelete && (
          <Pressable
            onPress={onDelete}
            className="p-1 rounded-full opacity-40 hover:opacity-100 hover:bg-red-500/10 active:bg-red-500/20 ml-1"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.9 }] } : undefined)}
            accessibilityLabel="Delete expense block"
          >
            <Trash2 size={13} color={isDark ? '#B5B5B5' : '#626262'} />
          </Pressable>
        )}
      </View>

      {/* Meta Chips: Category, Date, Status */}
      <View className="flex-row items-center flex-wrap gap-2 pl-10">
        {/* Category Pill */}
        <Pressable
          onPress={handleCycleCategory}
          className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Cycle expense category"
        >
          <Tag size={10} color={isDark ? '#34D399' : '#059669'} />
          <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
            {category}
          </Text>
        </Pressable>

        {/* Date Chip */}
        <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border/70 dark:border-white/10">
          <Calendar size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
          <Text className="text-[11px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
            {date}
          </Text>
        </View>

        {/* Status Pill (Cleared / Pending) */}
        <Pressable
          onPress={handleToggleStatus}
          className={`flex-row items-center gap-1 px-2.5 py-0.5 rounded-full border ${
            status === 'cleared'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : undefined)}
          accessibilityLabel="Toggle expense status"
        >
          <CheckCircle2
            size={10}
            color={status === 'cleared' ? '#10B981' : '#F59E0B'}
            strokeWidth={2.4}
          />
          <Text
            className={`text-[10px] font-bold uppercase tracking-wider ${
              status === 'cleared'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {status}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

