/**
 * ScribeX Markdown AST Serializer & Parser
 * Bidirectional round-tripping between Extended Markdown (.md) and ComposableBlock[]
 * Barrel re-export preserving backward compatibility across all modules and tests.
 */

export { coalesceChecklistBlocks } from './ast/astHelpers';
export { parseMarkdownToBlocks } from './ast/parseMarkdown';
export { serializeBlocksToMarkdown } from './ast/serializeBlocks';
