import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { useTheme } from '../../../theme';
import { 
  Sheet as SheetIcon, 
  Plus, 
  Trash2, 
  Calculator, 
  Download, 
  Upload, 
  Table, 
  Hash, 
  DollarSign, 
  Type, 
  Calendar,
  ChevronDown
} from 'lucide-react-native';

export type ColumnType = 'text' | 'number' | 'currency' | 'date';
export type SummaryFunction = 'sum' | 'avg' | 'count' | 'none';

export interface SheetColumn {
  id: string;
  name: string;
  type: ColumnType;
}

export interface SheetTab {
  id: string;
  name: string;
  columns: SheetColumn[];
  rows: string[][];
  summaryFunction?: SummaryFunction;
}

export interface SpreadsheetBlockMetadata {
  title?: string;
  activeTabId?: string;
  tabs?: SheetTab[];
}

interface SpreadsheetBlockProps {
  metadata?: SpreadsheetBlockMetadata;
  content?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  onFocus?: () => void;
  onDelete?: () => void;
  onStartDrag?: (pageY?: number) => void;
  onUpdateSheet?: (updates: SpreadsheetBlockMetadata) => void;
}

const DEFAULT_TABS: SheetTab[] = [
  {
    id: 'tab-1',
    name: 'Q4 Budget & Forecast',
    columns: [
      { id: 'c1', name: 'Item', type: 'text' },
      { id: 'c2', name: 'Category', type: 'text' },
      { id: 'c3', name: 'Allocated', type: 'currency' },
      { id: 'c4', name: 'Actual', type: 'currency' },
    ],
    rows: [
      ['Cloud Hosting (AWS & Supabase)', 'Infrastructure', '1200.00', '1048.50'],
      ['Mobile CI/CD Build Pipelines', 'Tooling', '450.00', '420.00'],
      ['Vector Embeddings API Quota', 'AI Services', '800.00', '650.00'],
      ['Domain & Security Certs', 'Security', '150.00', '150.00'],
    ],
    summaryFunction: 'sum',
  },
  {
    id: 'tab-2',
    name: 'Sprint Metrics',
    columns: [
      { id: 's1', name: 'Sprint', type: 'text' },
      { id: 's2', name: 'Velocity (pts)', type: 'number' },
      { id: 's3', name: 'Bugs Fixed', type: 'number' },
    ],
    rows: [
      ['Sprint 14', '42', '6'],
      ['Sprint 15', '48', '3'],
      ['Sprint 16', '55', '2'],
    ],
    summaryFunction: 'avg',
  },
];

export const SpreadsheetBlock: React.FC<SpreadsheetBlockProps> = ({
  metadata,
  content = '',
  isSelected = false,
  isDragging = false,
  onFocus,
  onDelete,
  onStartDrag,
  onUpdateSheet,
}) => {
  const { isDark } = useTheme();

  const title = metadata?.title || content || 'Financial & Operational Sheet';
  const tabs = metadata?.tabs && metadata.tabs.length > 0 ? metadata.tabs : DEFAULT_TABS;
  const activeTabId = metadata?.activeTabId || tabs[0]?.id || '';

  const [localTitle, setLocalTitle] = useState(title);
  const [currentTabId, setCurrentTabId] = useState(activeTabId);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  const currentTab = useMemo(() => {
    return tabs.find(t => t.id === currentTabId) || tabs[0] || DEFAULT_TABS[0];
  }, [tabs, currentTabId]);

  const commitUpdates = (partial: Partial<SpreadsheetBlockMetadata>) => {
    onUpdateSheet?.({
      title: localTitle,
      activeTabId: currentTabId,
      tabs,
      ...partial,
    });
  };

  const handleUpdateTab = (tabId: string, partial: Partial<SheetTab>) => {
    const nextTabs = tabs.map(t => t.id === tabId ? { ...t, ...partial } : t);
    commitUpdates({ tabs: nextTabs });
  };

  const handleAddTab = () => {
    onFocus?.();
    const newTabId = `tab-${Date.now()}`;
    const newTab: SheetTab = {
      id: newTabId,
      name: `Sheet ${tabs.length + 1}`,
      columns: [
        { id: `col-1`, name: 'Item', type: 'text' },
        { id: `col-2`, name: 'Amount', type: 'currency' },
      ],
      rows: [
        ['Example item', '100.00'],
      ],
      summaryFunction: 'sum',
    };
    const nextTabs = [...tabs, newTab];
    setCurrentTabId(newTabId);
    commitUpdates({ tabs: nextTabs, activeTabId: newTabId });
  };

  const handleDeleteTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter(t => t.id !== tabId);
    const nextActive = nextTabs[0]?.id || '';
    setCurrentTabId(nextActive);
    commitUpdates({ tabs: nextTabs, activeTabId: nextActive });
  };

  const handleUpdateCell = (rowIdx: number, colIdx: number, val: string) => {
    const nextRows = currentTab.rows.map((row, r) => {
      if (r !== rowIdx) return row;
      const nextRow = [...row];
      nextRow[colIdx] = val;
      return nextRow;
    });
    handleUpdateTab(currentTab.id, { rows: nextRows });
  };

  const handleAddRow = () => {
    onFocus?.();
    const emptyRow = currentTab.columns.map(() => '');
    const nextRows = [...currentTab.rows, emptyRow];
    handleUpdateTab(currentTab.id, { rows: nextRows });
  };

  const handleDeleteRow = (rowIdx: number) => {
    const nextRows = currentTab.rows.filter((_, r) => r !== rowIdx);
    handleUpdateTab(currentTab.id, { rows: nextRows });
  };

  const handleAddColumn = () => {
    onFocus?.();
    const newColId = `col-${Date.now()}`;
    const newCol: SheetColumn = {
      id: newColId,
      name: `Col ${currentTab.columns.length + 1}`,
      type: 'text',
    };
    const nextCols = [...currentTab.columns, newCol];
    const nextRows = currentTab.rows.map(row => [...row, '']);
    handleUpdateTab(currentTab.id, { columns: nextCols, rows: nextRows });
  };

  const handleDeleteColumn = (colIdx: number) => {
    if (currentTab.columns.length <= 1) return;
    const nextCols = currentTab.columns.filter((_, c) => c !== colIdx);
    const nextRows = currentTab.rows.map(row => row.filter((_, c) => c !== colIdx));
    handleUpdateTab(currentTab.id, { columns: nextCols, rows: nextRows });
  };

  const handleUpdateColumn = (colIdx: number, partial: Partial<SheetColumn>) => {
    const nextCols = currentTab.columns.map((col, c) => c === colIdx ? { ...col, ...partial } : col);
    handleUpdateTab(currentTab.id, { columns: nextCols });
  };

  const handleCycleColumnType = (colIdx: number) => {
    onFocus?.();
    const types: ColumnType[] = ['text', 'currency', 'number', 'date'];
    const curType = currentTab.columns[colIdx].type;
    const nextType = types[(types.indexOf(curType) + 1) % types.length];
    handleUpdateColumn(colIdx, { type: nextType });
  };

  const handleCycleSummary = () => {
    onFocus?.();
    const funcs: SummaryFunction[] = ['sum', 'avg', 'count', 'none'];
    const cur = currentTab.summaryFunction || 'sum';
    const next = funcs[(funcs.indexOf(cur) + 1) % funcs.length];
    handleUpdateTab(currentTab.id, { summaryFunction: next });
  };

  // Calculations for summary row
  const columnSummaries = useMemo(() => {
    const func = currentTab.summaryFunction || 'sum';
    if (func === 'none') return null;

    return currentTab.columns.map((col, colIdx) => {
      if (col.type !== 'number' && col.type !== 'currency') {
        if (colIdx === 0) return `${func.toUpperCase()}`;
        return '';
      }

      const numbers = currentTab.rows
        .map(r => parseFloat(r[colIdx]?.replace(/[^0-9.-]+/g, '')) || 0)
        .filter(n => !isNaN(n));

      if (numbers.length === 0) return '-';

      if (func === 'sum') {
        const sum = numbers.reduce((acc, v) => acc + v, 0);
        return col.type === 'currency' ? `$${sum.toFixed(2)}` : sum.toString();
      } else if (func === 'avg') {
        const avg = numbers.reduce((acc, v) => acc + v, 0) / numbers.length;
        return col.type === 'currency' ? `$${avg.toFixed(2)}` : avg.toFixed(1);
      } else if (func === 'count') {
        return `${numbers.length}`;
      }
      return '';
    });
  }, [currentTab]);

  const handleExportCsv = () => {
    const header = currentTab.columns.map(c => `"${c.name}"`).join(',');
    const rows = currentTab.rows.map(r => r.map(c => `"${c}"`).join(','));
    const fullCsv = [header, ...rows].join('\n');
    setCsvText(fullCsv);
    setIsCsvModalOpen(true);
  };

  const handleImportCsv = () => {
    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) return;

    const parseCsvLine = (line: string): string[] => {
      const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      return match ? match.map(m => m.replace(/^"|"$/g, '').trim()) : line.split(',');
    };

    const header = parseCsvLine(lines[0]);
    const newCols: SheetColumn[] = header.map((name, i) => ({
      id: `c-${i}`,
      name: name || `Col ${i + 1}`,
      type: 'text',
    }));

    const newRows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parsedRow = parseCsvLine(lines[i]);
      while (parsedRow.length < newCols.length) parsedRow.push('');
      newRows.push(parsedRow);
    }

    handleUpdateTab(currentTab.id, { columns: newCols, rows: newRows });
    setIsCsvModalOpen(false);
  };

  return (
    <Pressable
      onPress={onFocus}
      onLongPress={() => onStartDrag?.()}
      delayLongPress={250}
      className="my-3 w-full"
    >
      <View
        style={{
          borderColor: isSelected
            ? '#10B981'
            : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
          backgroundColor: isDark ? 'rgba(18, 18, 22, 0.7)' : 'rgba(250, 250, 252, 0.9)',
        }}
        className="rounded-2xl border transition-all overflow-hidden p-4"
      >
        {/* Top Header: Badge, Title & Toolbar Actions */}
        <View className="flex-row items-start justify-between gap-3 mb-2.5 pb-2.5 border-b border-light-border dark:border-white/5">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1.5 flex-wrap">
              {/* Spreadsheet Badge */}
              <View className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <Table size={11} color="#10B981" />
                <Text className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Spreadsheet
                </Text>
              </View>

              {/* Summary Toggle Pill */}
              <Pressable
                onPress={handleCycleSummary}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              >
                <Calculator size={10} color="#10B981" />
                <Text className="text-[10px] font-mono font-bold uppercase text-emerald-400">
                  Calc: {currentTab.summaryFunction || 'sum'}
                </Text>
              </Pressable>

              {/* CSV Quick Import / Export Button */}
              <Pressable
                onPress={handleExportCsv}
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/5"
              >
                <Download size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
                <Text className="text-[10px] text-light-textMuted dark:text-dark-textMuted font-mono">
                  CSV
                </Text>
              </Pressable>
            </View>

            {/* Sheet Title Input */}
            <TextInput
              value={localTitle}
              onChangeText={(t) => {
                setLocalTitle(t);
                commitUpdates({ title: t });
              }}
              onFocus={onFocus}
              placeholder="Spreadsheet Title..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-base font-bold text-light-textPrimary dark:text-dark-textPrimary py-0.5"
            />
          </View>

          {/* Delete Block */}
          {Boolean(onDelete) && (
            <Pressable
              onPress={onDelete}
              className="p-1.5 rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>

        {/* Multi-Sheet Tabs Bar */}
        <View className="flex-row items-center gap-1 mb-3 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            return (
              <View
                key={tab.id}
                style={{
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  borderColor: isActive ? 'rgba(16, 185, 129, 0.4)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border"
              >
                <Pressable onPress={() => setCurrentTabId(tab.id)}>
                  <Text
                    style={{ color: isActive ? '#10B981' : isDark ? '#A1A1AA' : '#71717A' }}
                    className="text-xs font-bold"
                  >
                    {tab.name}
                  </Text>
                </Pressable>
                {tabs.length > 1 && (
                  <Pressable onPress={() => handleDeleteTab(tab.id)} className="opacity-50 hover:opacity-100">
                    <Text className="text-[10px] font-bold text-light-textMuted dark:text-dark-textMuted">×</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable
            onPress={handleAddTab}
            className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-dashed border-light-border dark:border-white/10 flex-row items-center gap-1"
          >
            <Plus size={10} color={isDark ? '#A1A1AA' : '#71717A'} />
            <Text className="text-[10px] font-medium text-light-textMuted dark:text-dark-textMuted">
              New Sheet
            </Text>
          </Pressable>
        </View>

        {/* Data Grid Table */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} className="w-full">
          <View className="rounded-xl border border-light-border dark:border-white/10 overflow-hidden">
            {/* Column Headers */}
            <View className="flex-row bg-black/5 dark:bg-white/5 border-b border-light-border dark:border-white/10">
              <View className="w-8 p-2 items-center justify-center border-r border-light-border dark:border-white/10">
                <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">#</Text>
              </View>

              {currentTab.columns.map((col, cIdx) => (
                <View
                  key={col.id}
                  className="w-36 p-1.5 border-r border-light-border dark:border-white/10 flex-row items-center justify-between"
                >
                  <TextInput
                    value={col.name}
                    onChangeText={(name) => handleUpdateColumn(cIdx, { name })}
                    onFocus={onFocus}
                    className="flex-1 text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary p-0"
                  />
                  <Pressable
                    onPress={() => handleCycleColumnType(cIdx)}
                    className="px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 flex-row items-center gap-0.5"
                  >
                    {col.type === 'currency' ? (
                      <DollarSign size={9} color="#10B981" />
                    ) : col.type === 'number' ? (
                      <Hash size={9} color="#38BDF8" />
                    ) : col.type === 'date' ? (
                      <Calendar size={9} color="#F59E0B" />
                    ) : (
                      <Type size={9} color={isDark ? '#A1A1AA' : '#71717A'} />
                    )}
                  </Pressable>
                  {currentTab.columns.length > 1 && (
                    <Pressable onPress={() => handleDeleteColumn(cIdx)} className="opacity-40 hover:opacity-100 ml-1">
                      <Trash2 size={10} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              ))}

              {/* Add Column Button */}
              <Pressable
                onPress={handleAddColumn}
                className="w-10 items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Plus size={12} color="#10B981" />
              </Pressable>
            </View>

            {/* Matrix Data Rows */}
            {currentTab.rows.map((row, rIdx) => (
              <View
                key={rIdx}
                className="flex-row border-b border-light-border dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                <View className="w-8 p-1.5 items-center justify-center border-r border-light-border dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                  <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
                    {rIdx + 1}
                  </Text>
                </View>

                {currentTab.columns.map((col, cIdx) => (
                  <View
                    key={col.id}
                    className="w-36 p-1.5 border-r border-light-border dark:border-white/10"
                  >
                    <TextInput
                      value={row[cIdx] || ''}
                      onChangeText={(val) => handleUpdateCell(rIdx, cIdx, val)}
                      onFocus={onFocus}
                      placeholder="-"
                      placeholderTextColor={isDark ? '#52525B' : '#D1D5DB'}
                      className={`text-xs text-light-textPrimary dark:text-dark-textPrimary p-0 ${
                        col.type === 'number' || col.type === 'currency' ? 'font-mono text-right' : ''
                      }`}
                    />
                  </View>
                ))}

                {/* Delete Row Button */}
                <Pressable
                  onPress={() => handleDeleteRow(rIdx)}
                  className="w-10 items-center justify-center opacity-30 hover:opacity-100"
                >
                  <Trash2 size={11} color="#EF4444" />
                </Pressable>
              </View>
            ))}

            {/* Summary Row */}
            {columnSummaries && (
              <View className="flex-row bg-emerald-500/10 border-t-2 border-emerald-500/30">
                <View className="w-8 p-1.5 items-center justify-center border-r border-emerald-500/20">
                  <Calculator size={10} color="#10B981" />
                </View>

                {currentTab.columns.map((col, cIdx) => (
                  <View
                    key={col.id}
                    className="w-36 p-1.5 border-r border-emerald-500/20 flex-row items-center justify-between"
                  >
                    <Text
                      className={`text-xs font-mono font-bold text-emerald-400 ${
                        col.type === 'number' || col.type === 'currency' ? 'w-full text-right' : ''
                      }`}
                    >
                      {columnSummaries[cIdx] || ''}
                    </Text>
                  </View>
                ))}

                <View className="w-10" />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Actions Row */}
        <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-light-border dark:border-white/5">
          <Pressable
            onPress={handleAddRow}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20"
          >
            <Plus size={11} color="#10B981" />
            <Text className="text-[11px] font-bold text-emerald-400">Add Row</Text>
          </Pressable>

          <Text className="text-[10px] font-mono text-light-textMuted dark:text-dark-textMuted">
            {currentTab.rows.length} rows • {currentTab.columns.length} columns • Tab: {currentTab.name}
          </Text>
        </View>

        {/* CSV Import/Export Modal */}
        {isCsvModalOpen && (
          <View className="mt-3 p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-light-border dark:border-white/10">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-light-textPrimary dark:text-dark-textPrimary">
                CSV Data Bridge
              </Text>
              <Pressable onPress={() => setIsCsvModalOpen(false)}>
                <Text className="text-xs font-bold text-light-textMuted dark:text-dark-textMuted">Close</Text>
              </Pressable>
            </View>
            <TextInput
              value={csvText}
              onChangeText={setCsvText}
              multiline
              numberOfLines={4}
              placeholder="Paste comma-separated values..."
              placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              className="text-xs font-mono text-light-textPrimary dark:text-dark-textPrimary p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 mb-2"
            />
            <View className="flex-row items-center justify-end gap-2">
              <Pressable
                onPress={handleImportCsv}
                className="px-3 py-1 rounded-lg bg-emerald-600 flex-row items-center gap-1"
              >
                <Upload size={11} color="#FFFFFF" />
                <Text className="text-[11px] font-bold text-white">Import CSV into Sheet</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};

