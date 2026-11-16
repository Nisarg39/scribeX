/**
 * ScribeX WhatsApp Export Chat Detection & Ingestion Test Suite
 * Tests 100% of the WhatsApp chat transcript parsing, export detection,
 * AST block synthesis with media attachments, and strict rejection of non-WhatsApp shares.
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  sanitizeWhatsAppText,
  normalizeWhatsAppMarkdown,
  parseWhatsAppPoll,
  isWhatsAppChatTranscript,
  parseWhatsAppChat,
} from '../frontend/src/core/share/whatsappChatParser.ts';

import {
  isWhatsAppExportPayload,
  synthesizeShareBlocks,
} from '../frontend/src/core/share/shareBlockSynthesizer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=================================================================');
console.log('💬 SCRIBEX WHATSAPP EXPORT CHAT INGESTION TEST HARNESS');
console.log('   Target: WhatsApp Export Detection, Transcript Parsing & AST Synthesis');
console.log('=================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function run() {
  console.log('--- Suite 1: WhatsApp Text Sanitization & Markdown Normalization ---');

  test('WF-1: Sanitizes invisible Unicode direction marks and narrow non-breaking spaces', () => {
    const raw = '\u200e[14/11/26, 10:15:32\u202fAM]\u200f Alice: Hello World\u00a0!';
    const sanitized = sanitizeWhatsAppText(raw);
    assert.strictEqual(sanitized, '[14/11/26, 10:15:32 AM] Alice: Hello World !');
  });

  test('WF-2: Normalizes WhatsApp *bold* and ~strike~ to GitHub Flavored Markdown', () => {
    const raw = 'Please review *urgent* sprint task and ~skip~ regular sync';
    const normalized = normalizeWhatsAppMarkdown(raw);
    assert.strictEqual(normalized, 'Please review **urgent** sprint task and ~~skip~~ regular sync');
  });

  console.log('\n--- Suite 2: Multi-Message Chat Transcript Parsing ---');

  test('WF-3: Parses iOS Bracketed transcript with AM/PM and multiline folding', () => {
    const transcript = `
[14/11/26, 10:15:32 AM] Alice: Hey Bob, check out the new architecture:
- SQLite persistence
- Sub-5ms latency
[14/11/26, 10:16:05 AM] Bob: Looks fantastic! Let's ship it.
`;
    assert.strictEqual(isWhatsAppChatTranscript(transcript), true);
    const result = parseWhatsAppChat(transcript);
    assert.strictEqual(result.participants.length, 2);
    assert.deepStrictEqual(result.participants.sort(), ['Alice', 'Bob'].sort());
    assert.strictEqual(result.messages.length, 2);
    assert.strictEqual(result.messages[0].sender, 'Alice');
    assert.ok(result.messages[0].content.includes('- SQLite persistence'));
    assert.ok(result.messages[0].content.includes('- Sub-5ms latency'));
    assert.strictEqual(result.messages[1].sender, 'Bob');
  });

  test('WF-4: Parses Android Dash-Separated transcript', () => {
    const transcript = `
14/11/2026, 22:15 - Charlie: Meeting starts in 5 minutes.
14/11/2026, 22:17 - Dave: Joining now with presentation deck.
`;
    assert.strictEqual(isWhatsAppChatTranscript(transcript), true);
    const result = parseWhatsAppChat(transcript);
    assert.strictEqual(result.participants.length, 2);
    assert.strictEqual(result.messages[0].sender, 'Charlie');
    assert.strictEqual(result.messages[1].sender, 'Dave');
  });

  test('WF-5: Parses Android Copied format [Time, Date]', () => {
    const transcript = `
[10:15, 14/11/2026] Alice: Copied transcript check
[10:16, 14/11/2026] Bob: Confirmed received
`;
    assert.strictEqual(isWhatsAppChatTranscript(transcript), true);
    const result = parseWhatsAppChat(transcript);
    assert.strictEqual(result.messages.length, 2);
    assert.strictEqual(result.messages[0].sender, 'Alice');
  });

  test('WF-6: Filters out system encryption and security banners', () => {
    const transcript = `
Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
[14/11/26, 10:15:00 AM] Alice: Only actual messages should be parsed.
`;
    const result = parseWhatsAppChat(transcript);
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].sender, 'Alice');
  });

  test('WF-7: Detects inline attachment markers (<attached: file> and (file attached))', () => {
    const transcript = `
[14/11/26, 10:15:00 AM] Alice: <attached: sprint-diagram.png> Here is the diagram
14/11/2026, 10:16 - Bob: PTT-20261114-WA0001.opus (file attached)
Voice message explaining the diagram
`;
    const result = parseWhatsAppChat(transcript);
    assert.strictEqual(result.hasMediaAttachments, true);
    assert.strictEqual(result.messages[0].attachmentName, 'sprint-diagram.png');
    assert.strictEqual(result.messages[1].attachmentName, 'PTT-20261114-WA0001.opus');
  });

  test('WF-8: Parses WhatsApp Poll text into structured question & vote counts', () => {
    const pollText = `
POLL: Where should we host the offsite?
OPTION: Lake Tahoe (8 votes)
OPTION: San Diego (4 votes)
OPTION: Big Sur (12 votes)
`;
    const poll = parseWhatsAppPoll(pollText);
    assert.ok(poll !== null);
    assert.strictEqual(poll.question, 'Where should we host the offsite?');
    assert.strictEqual(poll.options.length, 3);
    assert.strictEqual(poll.options[0].text, 'Lake Tahoe');
    assert.strictEqual(poll.options[0].votes, 8);
    assert.strictEqual(poll.options[2].votes, 12);
  });

  console.log('\n--- Suite 3: WhatsApp Export Chat Detection ---');

  test('WF-9: Detects WhatsApp export when text contains chat transcript', () => {
    const payload = {
      batchId: 'detect-1',
      text: '[14/11/26, 10:15 AM] Alice: Hey there\n[14/11/26, 10:16 AM] Bob: Hello',
      files: [],
    };
    assert.strictEqual(isWhatsAppExportPayload(payload), true);
  });

  test('WF-10: Detects WhatsApp export when files contain _chat.txt or WhatsApp Chat *.txt', () => {
    const payload1 = {
      batchId: 'detect-2',
      text: '',
      files: [{ uri: 'file:///shared/_chat.txt', fileName: '_chat.txt', mimeType: 'text/plain' }],
    };
    assert.strictEqual(isWhatsAppExportPayload(payload1), true);

    const payload2 = {
      batchId: 'detect-3',
      text: '',
      files: [{ uri: 'file:///shared/WhatsApp Chat with Alice.txt', fileName: 'WhatsApp Chat with Alice.txt', mimeType: 'text/plain' }],
    };
    assert.strictEqual(isWhatsAppExportPayload(payload2), true);
  });

  test('WF-11: Detects WhatsApp export when subject specifies WhatsApp Chat', () => {
    const payload = {
      batchId: 'detect-4',
      subject: 'WhatsApp Chat with Team',
      files: [],
    };
    assert.strictEqual(isWhatsAppExportPayload(payload), true);
  });

  console.log('\n--- Suite 4: WhatsApp Export Chat Block Synthesis ---');

  test('WF-12: Synthesizes Full WhatsApp Chat into message_thread block + smart title', () => {
    const payload = {
      batchId: 'batch-test-1',
      text: `
[14/11/26, 10:15 AM] Alice: Hey Bob, here is the new doc
[14/11/26, 10:16 AM] Bob: Got it, reviewing now
`,
      files: [],
    };

    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.title, 'WhatsApp Chat · Alice & Bob');
    assert.ok(result.tags.includes('whatsapp'));
    assert.ok(result.tags.includes('chat-capture'));
    assert.strictEqual(result.colorToken, 'lime');
    assert.strictEqual(result.blocks.length, 1);
    assert.strictEqual(result.blocks[0].type, 'message_thread');
    assert.strictEqual(result.blocks[0].metadata?.channel, 'whatsapp');
    assert.strictEqual(result.blocks[0].metadata?.messages?.length, 2);
  });

  test('WF-13: Synthesizes WhatsApp Chat containing embedded Poll', () => {
    const payload = {
      batchId: 'batch-test-2',
      text: `
[14/11/26, 10:15 AM] Sarah: Check the poll below
POLL: Choose release day
OPTION: Tuesday (10 votes)
OPTION: Thursday (15 votes)
[14/11/26, 10:16 AM] John: Voted for Tuesday!
`,
      files: [],
    };

    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.ok(result.blocks.some((b) => b.type === 'message_thread'));
    const checklistBlock = result.blocks.find((b) => b.type === 'checklist');
    assert.ok(checklistBlock !== undefined);
    assert.strictEqual(checklistBlock.metadata?.items?.length, 2);
  });

  test('WF-14: Synthesizes individual media attachments (opus audio + png + mp4 + pdf) preserving file:// URI in content', () => {
    const payload = {
      batchId: 'batch-test-3',
      text: 'Sprint artifacts attached',
      files: [
        {
          uri: 'file:///shared_media/PTT-20261114-WA0001.opus',
          fileName: 'PTT-20261114-WA0001.opus',
          mimeType: 'audio/ogg',
          fileSize: 45000,
        },
        {
          uri: 'file:///shared_media/sprint-diagram.png',
          fileName: 'sprint-diagram.png',
          mimeType: 'image/png',
          fileSize: 120000,
        },
        {
          uri: 'file:///shared_media/demo.mp4',
          fileName: 'demo.mp4',
          mimeType: 'video/mp4',
          fileSize: 640000,
        },
        {
          uri: 'file:///shared_media/spec.pdf',
          fileName: 'spec.pdf',
          mimeType: 'application/pdf',
          fileSize: 850000,
        },
      ],
    };

    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    const audioBlock = result.blocks.find((b) => b.type === 'audio');
    const imageBlock = result.blocks.find((b) => b.type === 'image');
    const videoBlock = result.blocks.find((b) => b.type === 'video');
    const fileBlock = result.blocks.find((b) => b.type === 'file');
    assert.ok(audioBlock !== undefined);
    assert.strictEqual(audioBlock.content, 'file:///shared_media/PTT-20261114-WA0001.opus');
    assert.ok(imageBlock !== undefined);
    assert.strictEqual(imageBlock.content, 'file:///shared_media/sprint-diagram.png');
    assert.ok(videoBlock !== undefined);
    assert.strictEqual(videoBlock.content, 'file:///shared_media/demo.mp4');
    assert.ok(fileBlock !== undefined);
    assert.strictEqual(fileBlock.content, 'file:///shared_media/spec.pdf');
  });

  test('WF-15: Stores WhatsApp Export Chat .zip and .txt files as intact FileBlocks (OOM prevention)', () => {
    const zipPayload = {
      batchId: 'batch-test-zip',
      subject: 'WhatsApp Chat with Engineering Team',
      files: [
        {
          uri: 'file:///shared_media/WhatsApp_Chat_with_Engineering_Team.zip',
          fileName: 'WhatsApp Chat with Engineering Team.zip',
          mimeType: 'application/zip',
          fileSize: 48500000,
        },
      ],
    };

    const zipResult = synthesizeShareBlocks(zipPayload);
    assert.ok(zipResult !== null);
    assert.strictEqual(zipResult.blocks.length, 1);
    assert.strictEqual(zipResult.blocks[0].type, 'file');
    assert.strictEqual(
      zipResult.blocks[0].content,
      'file:///shared_media/WhatsApp_Chat_with_Engineering_Team.zip'
    );
    assert.strictEqual(
      zipResult.blocks[0].metadata?.fileName,
      'WhatsApp Chat with Engineering Team.zip'
    );

    const txtPayload = {
      batchId: 'batch-test-4',
      files: [
        {
          uri: 'file:///shared_media/_chat.txt',
          fileName: '_chat.txt',
          mimeType: 'text/plain',
          fileSize: 3200,
        },
      ],
    };

    const txtResult = synthesizeShareBlocks(txtPayload);
    assert.ok(txtResult !== null);
    assert.strictEqual(txtResult.blocks.length, 1);
    assert.strictEqual(txtResult.blocks[0].type, 'file');
    assert.strictEqual(txtResult.blocks[0].content, 'file:///shared_media/_chat.txt');
  });

  console.log('\n--- Suite 5: Universal Individual Share Sheet Detection ---');

  test('WF-16: Synthesizes standalone URL / video link as bookmark block', () => {
    const payload = {
      batchId: 'generic-url',
      text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [],
    };
    assert.strictEqual(isWhatsAppExportPayload(payload), false);
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'bookmark');
    assert.strictEqual(result.blocks[0].content, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('WF-17: Synthesizes shared message with location URL as paragraph block', () => {
    const payload = {
      batchId: 'generic-loc',
      text: 'Meeting: https://maps.google.com/?q=37.7749,-122.4194',
      files: [],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'paragraph');
  });

  test('WF-18: Synthesizes standalone contact card (.vcf) as file block', () => {
    const payload = {
      batchId: 'generic-vcf',
      text: '',
      files: [
        {
          uri: 'file:///contacts/contact.vcf',
          fileName: 'contact.vcf',
          mimeType: 'text/vcard',
        },
      ],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'file');
    assert.strictEqual(result.blocks[0].content, 'file:///contacts/contact.vcf');
  });

  test('WF-19: Synthesizes standalone iCalendar (.ics) invite as file block', () => {
    const payload = {
      batchId: 'generic-ics',
      text: '',
      files: [
        {
          uri: 'file:///events/invite.ics',
          fileName: 'invite.ics',
          mimeType: 'text/calendar',
        },
      ],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'file');
    assert.strictEqual(result.blocks[0].content, 'file:///events/invite.ics');
  });

  test('WF-20: Synthesizes individual shared plain text message', () => {
    const payload = {
      batchId: 'generic-text',
      text: 'Remember to pick up groceries and milk on the way home.',
      files: [],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'paragraph');
    assert.strictEqual(
      result.blocks[0].content,
      'Remember to pick up groceries and milk on the way home.'
    );
  });

  test('WF-21: Synthesizes individual photo share with preserved file:// URI', () => {
    const payload = {
      batchId: 'generic-photo',
      text: '',
      files: [
        {
          uri: 'file:///dcim/photo123.jpg',
          fileName: 'photo123.jpg',
          mimeType: 'image/jpeg',
          fileSize: 4500000,
        },
      ],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.blocks[0].type, 'image');
    assert.strictEqual(result.blocks[0].content, 'file:///dcim/photo123.jpg');
  });

  console.log('\n--- Suite 6: Advanced Edge Cases & Cross-Platform Resiliency ---');

  test('WF-22: Parses iOS Bracketed transcript without commas inside brackets', () => {
    const transcript = `[14/11/26 10:15:32 AM] Alice: Bracketed without comma test`;
    assert.strictEqual(isWhatsAppChatTranscript(transcript), true);
    const parsed = parseWhatsAppChat(transcript);
    assert.strictEqual(parsed.messages.length, 1);
    assert.strictEqual(parsed.messages[0].sender, 'Alice');
    assert.strictEqual(parsed.messages[0].content, 'Bracketed without comma test');
  });

  test('WF-23: Parses Android transcripts with en-dash (–) and em-dash (—) separators', () => {
    const enDashTranscript = `14/11/2026, 22:15 \u2013 Charlie: Meeting via en-dash`;
    assert.strictEqual(isWhatsAppChatTranscript(enDashTranscript), true);
    const enParsed = parseWhatsAppChat(enDashTranscript);
    assert.strictEqual(enParsed.messages.length, 1);
    assert.strictEqual(enParsed.messages[0].sender, 'Charlie');

    const emDashTranscript = `14/11/2026, 22:16 \u2014 Dave: Meeting via em-dash`;
    assert.strictEqual(isWhatsAppChatTranscript(emDashTranscript), true);
    const emParsed = parseWhatsAppChat(emDashTranscript);
    assert.strictEqual(emParsed.messages.length, 1);
    assert.strictEqual(emParsed.messages[0].sender, 'Dave');
  });

  test('WF-24: Identifies international localized WhatsApp chat export file names', () => {
    const spanishPayload = {
      batchId: 'es-1',
      files: [{ uri: 'file:///shared/Chat de WhatsApp con Maria.txt', fileName: 'Chat de WhatsApp con Maria.txt', mimeType: 'text/plain' }],
    };
    assert.strictEqual(isWhatsAppExportPayload(spanishPayload), true);

    const frenchPayload = {
      batchId: 'fr-1',
      files: [{ uri: 'file:///shared/Discussion WhatsApp avec Jean.txt', fileName: 'Discussion WhatsApp avec Jean.txt', mimeType: 'text/plain' }],
    };
    assert.strictEqual(isWhatsAppExportPayload(frenchPayload), true);

    const ptPayload = {
      batchId: 'pt-1',
      files: [{ uri: 'file:///shared/Conversa do WhatsApp com Pedro.txt', fileName: 'Conversa do WhatsApp com Pedro.txt', mimeType: 'text/plain' }],
    };
    assert.strictEqual(isWhatsAppExportPayload(ptPayload), true);
  });

  test('WF-25: Diarization / Self-sender detection marks isMe: true and customizes title', () => {
    const transcript = `
[14/11/26, 10:15 AM] Alice: Hey Marcus!
[14/11/26, 10:16 AM] You: Hey Alice, all done.
`;
    const payload = {
      batchId: 'diarize-1',
      text: transcript,
      files: [],
    };
    const result = synthesizeShareBlocks(payload);
    assert.ok(result !== null);
    assert.strictEqual(result.title, 'WhatsApp · Alice');
    const threadBlock = result.blocks.find((b) => b.type === 'message_thread');
    assert.ok(threadBlock !== undefined);
    const msgs = threadBlock.metadata?.messages;
    assert.strictEqual(msgs[0].isMe, false);
    assert.strictEqual(msgs[1].isMe, true);
  });

  test('WF-26: Resilient to leading blank lines and group encryption notice preamble', () => {
    const paddedTranscript = `
\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n
Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
14/11/2026, 10:00 - Alice created group "Core Architecture"
14/11/2026, 10:15 - Bob: First actual message after preamble!
`;
    assert.strictEqual(isWhatsAppChatTranscript(paddedTranscript), true);
    const parsed = parseWhatsAppChat(paddedTranscript);
    assert.strictEqual(parsed.subject, 'Core Architecture');
    assert.strictEqual(parsed.messages.length, 1);
    assert.strictEqual(parsed.messages[0].sender, 'Bob');
  });

  test('WF-27: Markdown normalization protects arithmetic asterisks and converts valid bold/strike', () => {
    const raw = 'Math: 5 * 4 * 3 = 60, but *urgent* and ~postponed~ are styled';
    const normalized = normalizeWhatsAppMarkdown(raw);
    assert.strictEqual(normalized, 'Math: 5 * 4 * 3 = 60, but **urgent** and ~~postponed~~ are styled');
  });

  test('WF-28: Detects Android attachments containing spaces in filename', () => {
    const transcript = `14/11/2026, 10:15 - Bob: sprint diagram final (1).png (file attached)\nCheck this out`;
    const parsed = parseWhatsAppChat(transcript);
    assert.strictEqual(parsed.hasMediaAttachments, true);
    assert.strictEqual(parsed.messages[0].attachmentName, 'sprint diagram final (1).png');
  });

  test('WF-29: Rejects empty share payload and synthesizes subject + text share cleanly', () => {
    const emptyPayload = {
      batchId: 'empty-share',
      text: '   ',
      files: [],
    };
    assert.strictEqual(synthesizeShareBlocks(emptyPayload), null);

    const subjectPayload = {
      batchId: 'subject-share',
      subject: 'Project Status Update',
      text: 'Just an update on deliverables.',
      files: [],
    };
    const res = synthesizeShareBlocks(subjectPayload);
    assert.ok(res !== null);
    assert.strictEqual(res.title, 'Project Status Update');
    assert.strictEqual(res.blocks[0].type, 'paragraph');
  });

  console.log('\n=================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('=================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run();
