import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { useTheme } from '../../../theme';
import { Plus, Minus, FileSpreadsheet, Trash2, X, Check } from 'lucide-react-native';

interface TableBlockProps {
  columns: string[];
  rows: string[][];
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onLongPress?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onEndDrag?: () => void;
  onDelete?: () => void;
  onUpdateTable: (columns: string[], rows: string[][]) => void;
}

export const TableBlock: React.FC<TableBlockProps> = ({
  columns: initialColumns = ['Header 1', 'Header 2'],
  rows: initialRows = [['Cell 1', 'Cell 2']],
  isSelected = false,
  isDragging = false,
  onFocus,
  onLongPress,
  onStartDrag,
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
    <Pressable
      onPress={onFocus}
      style={[
        {
          borderColor: isSelected
            ? '#06B6D4'
            : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)',
        },
      ]}
      className="my-1.5 w-full rounded-2xl border p-2.5 transition-all group"
    >
      {/* Table Actions Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <FileSpreadsheet size={13} color={isDark ? '#8EDCEB' : '#08C4E5'} />
          <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
            Table Grid ({rows.length} × {columns.length})
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          {/* Quick CSV Import Trigger */}
          <Pressable
            onPress={() => setCsvModalVisible(true)}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
          >
            <Text className="text-[10px] font-semibold text-light-textSecondary dark:text-dark-textSecondary">
              Paste CSV
            </Text>
          </Pressable>

          {/* Add Column Button */}
          <Pressable
            onPress={handleAddColumn}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
          >
            <Plus size={10} color={isDark ? '#F7F7F7' : '#171717'} />
            <Text className="text-[10px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Col
            </Text>
          </Pressable>

          {/* Add Row Button */}
          <Pressable
            onPress={handleAddRow}
            style={({ pressed }) => pressed ? { transform: [{ scale: 0.95 }] } : undefined}
            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10"
          >
            <Plus size={10} color={isDark ? '#F7F7F7' : '#171717'} />
            <Text className="text-[10px] font-semibold text-light-textPrimary dark:text-dark-textPrimary">
              Row
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Horizontal Scrollable Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} className="w-full">
        <View className="border border-light-border dark:border-white/10 rounded-xl overflow-hidden min-w-full">
          {/* Header Row */}
          <View className="flex-row bg-black/[0.04] dark:bg-[#1E1E1E] border-b border-light-border dark:border-white/10">
            {columns.map((colName, colIdx) => (
              <View
                key={`header-${colIdx}`}
                className="w-36 flex-row items-center justify-between px-2.5 py-1.5 border-r border-light-border/60 dark:border-white/5"
              >
                <TextInput
                  value={colName}
                  onChangeText={(text) => handleHeaderChange(text, colIdx)}
                  onFocus={onFocus}
                  className="flex-1 font-bold text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
                  placeholder={`Header ${colIdx + 1}`}
                  placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
                />

                {columns.length > 1 && (
                  <Pressable
                    onPress={() => handleRemoveColumn(colIdx)}
                    className="p-1 rounded opacity-40 hover:opacity-100"
                    accessibilityLabel="Delete Column"
                  >
                    <Minus size={9} color={isDark ? '#FF6B6B' : '#DC2626'} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {rows.map((row, rowIdx) => (
            <View
              key={`row-${rowIdx}`}
              className={`flex-row border-b border-light-border/40 dark:border-white/5 ${
                rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.015] dark:bg-white/[0.01]'
              }`}
            >
              {columns.map((_, colIdx) => (
                <View
                  key={`cell-${rowIdx}-${colIdx}`}
                  className="w-36 flex-row items-center justify-between px-2.5 py-1.5 border-r border-light-border/40 dark:border-white/5"
                >
                  <TextInput
                    value={row[colIdx] || ''}
                    onChangeText={(text) => handleCellChange(text, rowIdx, colIdx)}
                    onFocus={onFocus}
                    className="flex-1 text-xs text-light-textPrimary dark:text-dark-textPrimary py-0"
                    placeholder="—"
                    placeholderTextColor={isDark ? '#555555' : '#CCCCCC'}
                  />

                  {/* Row Delete handle on the rightmost cell */}
                  {colIdx === columns.length - 1 && rows.length > 1 && (
                    <Pressable
                      onPress={() => handleRemoveRow(rowIdx)}
                      className="p-1 rounded opacity-30 hover:opacity-100 ml-1"
                      accessibilityLabel="Delete Row"
                    >
                      <Trash2 size={9} color={isDark ? '#FF6B6B' : '#DC2626'} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CSV Import Modal */}
      <Modal
        visible={csvModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCsvModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="w-full max-w-lg bg-light-surface dark:bg-dark-surface rounded-2xl p-5 border border-light-border dark:border-white/10 shadow-2xl">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <FileSpreadsheet size={16} color={isDark ? '#8EDCEB' : '#08C4E5'} />
                <Text className="text-sm font-bold text-light-textPrimary dark:text-dark-textPrimary">
                  Paste Tabular Data or CSV
                </Text>
              </View>
              <Pressable onPress={() => setCsvModalVisible(false)}>
                <X size={16} color={isDark ? '#B5B5B5' : '#626262'} />
              </Pressable>
            </View>

            <TextInput
              value={csvInput}
              onChangeText={setCsvInput}
              placeholder="Paste tab-separated spreadsheet values, markdown tables, or comma-separated CSV..."
              placeholderTextColor={isDark ? '#626262' : '#A0A0A0'}
              multiline
              className="w-full h-40 p-3 rounded-xl bg-light-appBg dark:bg-dark-raised border border-light-border dark:border-white/10 font-mono text-xs text-light-textPrimary dark:text-dark-textPrimary mb-4"
            />

            <View className="flex-row items-center justify-end gap-2">
              <Pressable
                onPress={() => setCsvModalVisible(false)}
                className="px-4 py-2 rounded-full bg-light-appBg dark:bg-dark-raised"
              >
                <Text className="text-xs text-light-textSecondary dark:text-dark-textSecondary font-semibold">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleImportCsv}
                className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-light-iconBg dark:bg-white"
              >
                <Check size={14} color={isDark ? '#111111' : '#FFFFFF'} strokeWidth={2.5} />
                <Text className="text-xs font-bold text-white dark:text-[#111111]">
                  Parse & Insert
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
};
