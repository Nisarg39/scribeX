import { ComposableBlock, NoteColorToken } from '../../types/note';

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  iconName: string;
  colorToken: NoteColorToken;
  category: 'Work' | 'Engineering' | 'Daily' | 'Research';
  blocks: Omit<ComposableBlock, 'id'>[];
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Minutes',
    description: 'Attendees, agenda, key decisions, and action items',
    iconName: 'Users',
    colorToken: 'cyan',
    category: 'Work',
    blocks: [
      {
        type: 'callout',
        content: 'Meeting Goal: Align on sprint goals, review architecture, and assign deliverables.',
        metadata: { variant: 'info' },
      },
      {
        type: 'heading',
        content: 'Attendees',
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Product Engineering Lead\nFrontend Architect\nCore Systems Contributor',
        metadata: {
          items: [
            { id: 'att-1', text: 'Product Engineering Lead' },
            { id: 'att-2', text: 'Frontend Architect' },
            { id: 'att-3', text: 'Core Systems Contributor' },
          ],
        },
      },
      {
        type: 'heading',
        content: 'Discussion & Decisions',
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Agreed on offline-first local SQLite with sub-5ms transaction speed.\nAdopted unified 3-tier action tracking history for undo/redo.\nStreamlined canvas-native styling with zero generic card containers.',
        metadata: {
          items: [
            { id: 'disc-1', text: 'Agreed on offline-first local SQLite with sub-5ms transaction speed.' },
            { id: 'disc-2', text: 'Adopted unified 3-tier action tracking history for undo/redo.' },
            { id: 'disc-3', text: 'Streamlined canvas-native styling with zero generic card containers.' },
          ],
        },
      },
      {
        type: 'heading',
        content: 'Action Items',
        metadata: { level: 2 },
      },
      {
        type: 'checklist',
        content: 'Benchmark SQLite WAL mode on physical devices\nReview pull requests for bidirectional AST\nPublish documentation updates',
        metadata: {
          items: [
            { id: 'act-1', text: 'Benchmark SQLite WAL mode on physical devices', checked: false, priority: 'urgent', dueDate: 'Today', style: 'paragraph' },
            { id: 'act-2', text: 'Review pull requests for bidirectional AST', checked: false, priority: 'high', dueDate: 'Tomorrow', style: 'paragraph' },
            { id: 'act-3', text: 'Publish documentation updates', checked: false, priority: 'medium', dueDate: 'Oct 31', style: 'paragraph' },
          ],
        },
      },
    ],
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup',
    description: "Today's priorities, yesterday's progress, and blockers",
    iconName: 'Sun',
    colorToken: 'apricot',
    category: 'Daily',
    blocks: [
      {
        type: 'heading',
        content: "Today's Priorities",
        metadata: { level: 2 },
      },
      {
        type: 'checklist',
        content: 'Complete inline slash command keyboard navigation\nTest markdown line shortcuts across web and mobile\nVerify SQLite index latency',
        metadata: {
          items: [
            { id: 'prio-1', text: 'Complete inline slash command keyboard navigation', checked: false, priority: 'urgent', dueDate: 'Today', style: 'paragraph' },
            { id: 'prio-2', text: 'Test markdown line shortcuts across web and mobile', checked: false, priority: 'high', dueDate: 'Today', style: 'paragraph' },
            { id: 'prio-3', text: 'Verify SQLite index latency', checked: false, priority: 'medium', dueDate: 'Today', style: 'paragraph' },
          ],
        },
      },
      {
        type: 'heading',
        content: "Yesterday's Accomplishments",
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Shipped bulleted, numbered list, toggle, video, and location blocks.\nResolved React Native text node validation exception.',
        metadata: {
          items: [
            { id: 'yest-1', text: 'Shipped bulleted, numbered list, toggle, video, and location blocks.' },
            { id: 'yest-2', text: 'Resolved React Native text node validation exception.' },
          ],
        },
      },
      {
        type: 'heading',
        content: 'Blockers & Impediments',
        metadata: { level: 2 },
      },
      {
        type: 'callout',
        content: 'None currently. All systems operating at full capacity.',
        metadata: { variant: 'success' },
      },
    ],
  },
  {
    id: 'project-spec',
    name: 'Project Spec (PRD)',
    description: 'Problem statement, requirements table, and milestones',
    iconName: 'FileCode',
    colorToken: 'lavender',
    category: 'Engineering',
    blocks: [
      {
        type: 'callout',
        content: 'Problem: Users lose cognitive focus when interrupted by laggy cloud databases or clunky boxed card UI components.',
        metadata: { variant: 'info' },
      },
      {
        type: 'heading',
        content: 'Core Objectives',
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Sub-5ms local reads and writes using SQLite WAL mode.\nSeamless canvas aesthetics that eliminate generic cards.\nFull Markdown bidirectional round-trip with zero data loss.',
        metadata: {
          items: [
            { id: 'obj-1', text: 'Sub-5ms local reads and writes using SQLite WAL mode.' },
            { id: 'obj-2', text: 'Seamless canvas aesthetics that eliminate generic cards.' },
            { id: 'obj-3', text: 'Full Markdown bidirectional round-trip with zero data loss.' },
          ],
        },
      },
      {
        type: 'heading',
        content: 'Requirements Matrix',
        metadata: { level: 2 },
      },
      {
        type: 'table',
        content: '| Module | Priority | Status |\n| --- | --- | --- |\n| Slash Commands | P0 | Complete |\n| Markdown Shortcuts | P0 | Complete |\n| Backlinks Graph | P1 | In Progress |',
        metadata: {
          columns: ['Module', 'Priority', 'Status'],
          rows: [
            ['Slash Commands', 'P0', 'Complete'],
            ['Markdown Shortcuts', 'P0', 'Complete'],
            ['Backlinks Graph', 'P1', 'In Progress'],
          ],
        },
      },
      {
        type: 'heading',
        content: 'Phased Milestones',
        metadata: { level: 2 },
      },
      {
        type: 'checklist',
        content: 'Phase 1: Core manual block input completion\nPhase 2: Knowledge graph backlinks & relations\nPhase 3: Background sync and AI assistant',
        metadata: {
          items: [
            { id: 'mile-1', text: 'Phase 1: Core manual block input completion', checked: true, priority: 'urgent', dueDate: 'Oct 29', style: 'paragraph' },
            { id: 'mile-2', text: 'Phase 2: Knowledge graph backlinks & relations', checked: false, priority: 'high', dueDate: 'Nov 05', style: 'paragraph' },
            { id: 'mile-3', text: 'Phase 3: Background sync and AI assistant', checked: false, priority: 'medium', dueDate: 'Nov 15', style: 'paragraph' },
          ],
        },
      },
    ],
  },
  {
    id: 'weekly-review',
    name: 'Weekly Retrospective',
    description: 'Wins, metric review, reflections, and next week plan',
    iconName: 'RotateCcw',
    colorToken: 'lime',
    category: 'Work',
    blocks: [
      {
        type: 'heading',
        content: 'Weekly Highlights & Wins',
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Achieved complete cross-platform drag and drop with smooth GPU reordering.\nModularized editor architecture with clean hook separation.\nImplemented 3-tier undo/redo action tracking.',
        metadata: {
          items: [
            { id: 'win-1', text: 'Achieved complete cross-platform drag and drop with smooth GPU reordering.' },
            { id: 'win-2', text: 'Modularized editor architecture with clean hook separation.' },
            { id: 'win-3', text: 'Implemented 3-tier undo/redo action tracking.' },
          ],
        },
      },
      {
        type: 'heading',
        content: 'Key Learnings & Reflections',
        metadata: { level: 2 },
      },
      {
        type: 'quote',
        content: 'The details are not the details. They make the design.',
      },
      {
        type: 'heading',
        content: 'Next Week Commitments',
        metadata: { level: 2 },
      },
      {
        type: 'checklist',
        content: 'Deploy backlinks knowledge graph relations\nSynchronize note checklists with global tasks board',
        metadata: {
          items: [
            { id: 'comm-1', text: 'Deploy backlinks knowledge graph relations', checked: false, priority: 'high', dueDate: 'Next Week', style: 'paragraph' },
            { id: 'comm-2', text: 'Synchronize note checklists with global tasks board', checked: false, priority: 'medium', dueDate: 'Next Week', style: 'paragraph' },
          ],
        },
      },
    ],
  },
  {
    id: 'research-note',
    name: 'Deep Research Canvas',
    description: 'Hypothesis, reference bookmarks, and key findings',
    iconName: 'Compass',
    colorToken: 'pink',
    category: 'Research',
    blocks: [
      {
        type: 'callout',
        content: 'Hypothesis: Cognitive performance increases by 40% when notes are unstructured inputs linked via associative knowledge graphs.',
        metadata: { variant: 'info' },
      },
      {
        type: 'heading',
        content: 'Key References & Benchmarks',
        metadata: { level: 2 },
      },
      {
        type: 'bookmark',
        content: 'https://reactnative.dev',
        metadata: {
          url: 'https://reactnative.dev',
          title: 'React Native · Learn once, write anywhere',
          description: 'A framework for building native applications using React.',
        },
      },
      {
        type: 'heading',
        content: 'Synthesis & Insights',
        metadata: { level: 2 },
      },
      {
        type: 'bulleted_list',
        content: 'Direct AST transformations outperform DOM-based rich text editors on mobile devices.\nPredictive typing shortcuts eliminate 90% of menu navigation friction.',
        metadata: {
          items: [
            { id: 'syn-1', text: 'Direct AST transformations outperform DOM-based rich text editors on mobile devices.' },
            { id: 'syn-2', text: 'Predictive typing shortcuts eliminate 90% of menu navigation friction.' },
          ],
        },
      },
    ],
  },
];

/**
 * Instantiates fresh unique block IDs and nested item IDs for a chosen template
 */
export function instantiateTemplateBlocks(template: NoteTemplate): ComposableBlock[] {
  const timestamp = Date.now();
  return template.blocks.map((b, bIdx) => {
    const blockId = `b-tpl-${timestamp}-${bIdx + 1}`;
    let newMeta: Record<string, any> | undefined = undefined;

    if (b.metadata) {
      newMeta = JSON.parse(JSON.stringify(b.metadata));
      if (Array.isArray(newMeta?.items)) {
        newMeta.items = newMeta.items.map((it: any, iIdx: number) => {
          const prefix = b.type === 'checklist' ? 'task-tpl' : 'item-tpl';
          return {
            ...it,
            id: `${prefix}-${timestamp}-${bIdx + 1}-${iIdx + 1}`,
          };
        });
      }
    }

    return {
      ...b,
      id: blockId,
      metadata: newMeta,
    };
  });
}

