import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { useTheme } from '../../../theme';
import { Plus, Minus, FileSpreadsheet, Trash2, X, Check } from 'lucide-react-native';

interface TableBlockProps {
  columns: string[];
  rows: string[][];
  isSelected?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateTable: (columns: string[], rows: string[][]) => void;
}

export const TableBlock: React.FC<TableBlockProps> = ({
  columns: initialColumns = ['Header 1', 'Header 2'],
  rows: initialRows = [['Cell 1', 'Cell 2']],
  isSelected = false,
  onFocus,
  onLongPress,
  onEndDrag,
  onDelete,
  onUpdateTable,
}) => {
  const { isDark } = useTheme();
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  // Ensure minimum dimensions
  const columns = initialColumns.length > 0 ? initialColumns : ['Header 1', 'Header 2'];
  const rows = initialRows.length > 0 ? initialRows : [['', '']];

  const handleHeaderChange = (text: string, colIdx: number) => {
    const nextCols = [...columns];
    nextCols[colIdx] = text;
    onUpdateTable(nextCols, rows);
  };

  const handleCellChange = (text: string, rowIdx: number, colIdx: number) => {
    const nextRows = rows.map((r, rI) => {
      if (rI !== rowIdx) return r;
      const nextR = [...r];
      nextR[colIdx] = text;
      return nextR;
    });
    onUpdateTable(columns, nextRows);
  };

  const handleAddColumn = () => {
    const nextCols = [...columns, `Column ${columns.length + 1}`];
    const nextRows = rows.map(r => [...r, '']);
    onUpdateTable(nextCols, nextRows);
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (columns.length <= 1) return;
    const nextCols = columns.filter((_, idx) => idx !== colIdx);
    const nextRows = rows.map(r => r.filter((_, idx) => idx !== colIdx));
    onUpdateTable(nextCols, nextRows);
  };

  const handleAddRow = () => {
    const nextRows = [...rows, new Array(columns.length).fill('')];
    onUpdateTable(columns, nextRows);
  };

  const handleRemoveRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    const nextRows = rows.filter((_, idx) => idx !== rowIdx);
    onUpdateTable(columns, nextRows);
  };

  const handleImportCsv = () => {
    if (!csvInput.trim()) {
      setCsvModalVisible(false);
      return;
    }

    const lines = csvInput.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return;

    // Detect delimiter: comma, tab, or pipe
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes('|') ? '|' : ',';

    const parsedData = lines.map(line => {
      if (delimiter === '|') {
        return line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      }
      return line.split(delimiter).map(c => c.trim());
    });

    if (parsedData.length > 0) {
      const headerRow = parsedData[0];
      const dataRows = parsedData.slice(1).map(r => {
        const row = [...r];
        while (row.length < headerRow.length) row.push('');
        return row.slice(0, headerRow.length);
      });

      onUpdateTable(headerRow, dataRows.length > 0 ? dataRows : [new Array(headerRow.length).fill('')]);
    }

    setCsvInput('');
    setCsvModalVisible(false);
  };

  return (
    <View className="w-full">
      {/* Table Sub-Toolbar */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">

          <Pressable
            onPress={() => { onFocus?.(); handleAddRow(); }}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border"
          >
            <Plus size={12} color={isDark ? '#F7F7F7' : '#171717'} />
            <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
              + Row
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { onFocus?.(); handleAddColumn(); }}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border"
          >
            <Plus size={12} color={isDark ? '#F7F7F7' : '#171717'} />
            <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
              + Column
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { onFocus?.(); setCsvModalVisible(true); }}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border"
          >
            <FileSpreadsheet size={12} color={isDark ? '#8EDCEB' : '#08C4E5'} />
            <Text className="text-[11px] font-bold text-light-textPrimary dark:text-dark-textPrimary">
              CSV
            </Text>
          </Pressable>
        </View>

        <Text className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
          {rows.length} rows × {columns.length} cols
        </Text>
      </View>

      {/* Horizontal Scrollable Table Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border border-light-border dark:border-dark-border rounded-xl overflow-hidden">
        <View className="min-w-full">
          {/* Header Row */}
          <View className="flex-row bg-light-appBg dark:bg-dark-raised border-b border-light-border dark:border-dark-border">
            {columns.map((col, colIdx) => (
              <View key={`header-${colIdx}`} className="min-w-[120px] max-w-[200px] flex-1 p-2 border-r border-light-border/60 dark:border-dark-border/60 flex-row items-center justify-between">
                <TextInput
                  value={col}
                  onFocus={onFocus}
                  onChangeText={(text) => handleHeaderChange(text, colIdx)}
                  placeholder={`Header ${colIdx + 1}`}
                  placeholderTextColor={isDark ? '#858585' : '#929292'}
                  className="flex-1 font-bold text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
                />
                {columns.length > 1 && (
                  <Pressable
                    onPress={() => handleRemoveColumn(colIdx)}
                    className="ml-1 p-0.5 rounded opacity-40 hover:opacity-100"
                    accessibilityLabel="Remove column"
                  >
                    <X size={11} color={isDark ? '#B5B5B5' : '#626262'} />
                  </Pressable>
                )}
              </View>
            ))}
            <View className="w-8 items-center justify-center" />
          </View>

          {/* Table Data Rows */}
          {rows.map((row, rowIdx) => (
            <View 
              key={`row-${rowIdx}`} 
              className={`flex-row border-b border-light-border/40 dark:border-dark-border/40 ${
                rowIdx % 2 === 1 ? 'bg-black/[0.02] dark:bg-white/[0.02]' : 'bg-transparent'
              }`}
            >
              {row.map((cell, colIdx) => (
                <View key={`cell-${rowIdx}-${colIdx}`} className="min-w-[120px] max-w-[200px] flex-1 p-2 border-r border-light-border/40 dark:border-dark-border/40">
                  <TextInput
                    value={cell}
                    onFocus={onFocus}
                    onChangeText={(text) => handleCellChange(text, rowIdx, colIdx)}
                    placeholder="Empty"
                    placeholderTextColor={isDark ? '#626262' : '#B5B5B5'}
                    className="text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
                  />
                </View>
              ))}

              {/* Row Delete Button */}
              <View className="w-8 items-center justify-center">
                {rows.length > 1 && (
                  <Pressable
                    onPress={() => handleRemoveRow(rowIdx)}
                    className="p-1 rounded opacity-30 hover:opacity-100"
                    accessibilityLabel="Remove row"
                  >
                    <Trash2 size={11} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CSV Import Modal */}
      {csvModalVisible && (
        <Modal
          visible={csvModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCsvModalVisible(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="w-full max-w-md p-5 rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-2xl">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Paste CSV or Tab-Separated Data
                </Text>
                <Pressable
                  onPress={() => setCsvModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-light-appBg dark:bg-dark-raised items-center justify-center"
                >
                  <X size={15} color={isDark ? '#F7F7F7' : '#171717'} />
                </Pressable>
              </View>

              <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary mb-3">
                First row will be treated as column headers. Supports comma, tab, and pipe delimiters.
              </Text>

              <TextInput
                multiline
                numberOfLines={6}
                value={csvInput}
                onChangeText={setCsvInput}
                placeholder="Name, Role, Location&#10;Alice, Engineer, NYC&#10;Bob, Designer, London"
                placeholderTextColor={isDark ? '#858585' : '#929292'}
                className="p-3 rounded-2xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-dark-border font-mono text-xs text-light-textPrimary dark:text-dark-textPrimary min-h-[120px] mb-4"
                textAlignVertical="top"
              />

              <View className="flex-row items-center justify-end gap-2">
                <Pressable
                  onPress={() => setCsvModalVisible(false)}
                  className="px-4 py-2 rounded-full bg-light-appBg dark:bg-dark-raised"
                >
                  <Text className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleImportCsv}
                  className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-light-iconBg dark:bg-white"
                >
                  <Check size={14} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
                  <Text className="text-xs font-bold text-white dark:text-[#111111]">
                    Import Table
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};
