import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  CredentialKind,
  DBFolder,
  LockType,
  WorkspaceSecurityConfig,
} from '../db/types';
import {
  DEFAULT_SECURITY_CONFIG,
  LockTargetPayload,
  securityRepo,
} from '../db/securityRepo';
import { NoteItem } from '../types/note';
import { securityRateLimiter, verifyCredential } from '../core/security/pinCrypto';
import {
  buildFolderMapByPath,
  getBlockingLockedFoldersForPath,
  inspectNoteLockState,
  normalizeFolderPath,
  verifyTargetCredential,
} from '../core/security/vaultLockHelpers';
import {
  ActiveSecurityModalRequest,
  PinPasswordPromptModal,
} from '../components/security/PinPasswordPromptModal';
import {
  checkBiometricCapability,
  BiometricCapability,
} from '../core/security/biometrics';

interface SecurityContextValue {
  securityConfig: WorkspaceSecurityConfig;
  isSecurityLoading: boolean;
  isAppLocked: boolean;
  hasMasterConfigured: boolean;
  unlockedNoteIds: ReadonlySet<string>;
  unlockedFolderPaths: ReadonlySet<string>;
  activeUnlockedCount: number;
  biometricCapability: BiometricCapability | null;
  refreshBiometricCapability: () => Promise<BiometricCapability>;
  refreshSecurityConfig: () => Promise<WorkspaceSecurityConfig>;
  setupMasterCredential: (params: {
    secret: string;
    credentialKind: CredentialKind;
    hint?: string | null;
    enableAppLock?: boolean;
  }) => Promise<WorkspaceSecurityConfig>;
  clearMasterCredential: (options?: {
    unlockMasterLockedItems?: boolean;
  }) => Promise<WorkspaceSecurityConfig>;
  setAppLockEnabled: (enabled: boolean) => Promise<WorkspaceSecurityConfig>;
  setAutoRelockSeconds: (seconds: number) => Promise<WorkspaceSecurityConfig>;
  setBiometricsEnabled: (enabled: boolean) => Promise<WorkspaceSecurityConfig>;
  unlockAppWithCredential: (candidate: string) => {
    ok: boolean;
    error?: string;
    lockoutRemainingMs?: number;
  };
  unlockAppWithBiometrics: () => void;
  lockNow: () => void;
  relockAllSessions: () => void;
  markNoteUnlocked: (noteId: string) => void;
  markFolderUnlocked: (folderPath: string) => void;
  relockNoteSession: (noteId: string) => void;
  relockNoteOnEditorExit: (noteId: string) => void;
  relockFolderSession: (folderPath?: string) => void;
  relockFoldersOnSwitch: (nextFolderPath?: string | null) => void;
  promptUnlockFolder: (folder: DBFolder | string, allFolders: DBFolder[]) => Promise<boolean>;
  promptUnlockNote: (note: NoteItem, allFolders: DBFolder[]) => Promise<boolean>;
  promptConfigureLock: (params: {
    targetLabel: string;
    entityType: 'note' | 'folder' | 'batch_notes';
    initialLockType?: LockType;
    initialHint?: string | null;
  }) => Promise<LockTargetPayload | null>;
  promptVerifyTargetCredential: (params: {
    title: string;
    subtitle?: string;
    lockType: LockType;
    credentialKind?: CredentialKind | null;
    customHash?: string | null;
    customSalt?: string | null;
    hint?: string | null;
    rateLimitKey: string;
    confirmLabel?: string;
  }) => Promise<boolean>;
  promptVerifyMaster: (params?: {
    title?: string;
    subtitle?: string;
    confirmLabel?: string;
  }) => Promise<boolean>;
  promptSetupOrChangeMaster: (mode: 'create' | 'change') => Promise<boolean>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const SecurityContext = createContext<SecurityContextValue>({
  securityConfig: DEFAULT_SECURITY_CONFIG,
  isSecurityLoading: true,
  isAppLocked: false,
  hasMasterConfigured: false,
  unlockedNoteIds: EMPTY_SET,
  unlockedFolderPaths: EMPTY_SET,
  activeUnlockedCount: 0,
  biometricCapability: null,
  refreshBiometricCapability: async () => ({
    isAvailable: false,
    hasHardware: false,
    isEnrolled: false,
    displayName: 'Biometrics',
    supportedTypes: [],
  }),
  refreshSecurityConfig: async () => DEFAULT_SECURITY_CONFIG,
  setupMasterCredential: async () => DEFAULT_SECURITY_CONFIG,
  clearMasterCredential: async () => DEFAULT_SECURITY_CONFIG,
  setAppLockEnabled: async () => DEFAULT_SECURITY_CONFIG,
  setAutoRelockSeconds: async () => DEFAULT_SECURITY_CONFIG,
  setBiometricsEnabled: async () => DEFAULT_SECURITY_CONFIG,
  unlockAppWithCredential: () => ({ ok: false }),
  unlockAppWithBiometrics: () => {},
  lockNow: () => {},
  relockAllSessions: () => {},
  markNoteUnlocked: () => {},
  markFolderUnlocked: () => {},
  relockNoteSession: () => {},
  relockNoteOnEditorExit: () => {},
  relockFolderSession: () => {},
  relockFoldersOnSwitch: () => {},
  promptUnlockFolder: async () => false,
  promptUnlockNote: async () => false,
  promptConfigureLock: async () => null,
  promptVerifyTargetCredential: async () => false,
  promptVerifyMaster: async () => false,
  promptSetupOrChangeMaster: async () => false,
});

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [securityConfig, setSecurityConfig] = useState<WorkspaceSecurityConfig>(
    DEFAULT_SECURITY_CONFIG
  );
  const [isSecurityLoading, setIsSecurityLoading] = useState<boolean>(true);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Set<string>>(() => new Set());
  const [unlockedFolderPaths, setUnlockedFolderPaths] = useState<Set<string>>(() => new Set());
  const [activeModalRequest, setActiveModalRequest] =
    useState<ActiveSecurityModalRequest | null>(null);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);

  const refreshBiometricCapability = useCallback(async () => {
    const cap = await checkBiometricCapability();
    setBiometricCapability(cap);
    return cap;
  }, []);

  useEffect(() => {
    refreshBiometricCapability();
  }, [refreshBiometricCapability]);

  const noteExpiryRef = useRef<Map<string, number>>(new Map());
  const folderExpiryRef = useRef<Map<string, number>>(new Map());
  const unlockedNoteIdsRef = useRef<Set<string>>(new Set());
  const unlockedFolderPathsRef = useRef<Set<string>>(new Set());
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const modalIdRef = useRef<number>(1);
  const securityConfigRef = useRef<WorkspaceSecurityConfig>(DEFAULT_SECURITY_CONFIG);

  useEffect(() => {
    securityConfigRef.current = securityConfig;
  }, [securityConfig]);

  const hasMasterConfigured = Boolean(securityConfig.masterHash && securityConfig.masterSalt);

  const relockAllSessions = useCallback(() => {
    noteExpiryRef.current.clear();
    folderExpiryRef.current.clear();
    unlockedNoteIdsRef.current = new Set();
    unlockedFolderPathsRef.current = new Set();
    setUnlockedNoteIds(new Set());
    setUnlockedFolderPaths(new Set());
  }, []);

  const lockNow = useCallback(() => {
    relockAllSessions();
    const cfg = securityConfigRef.current;
    if (cfg.appLockEnabled && cfg.masterHash && cfg.masterSalt) {
      setIsAppLocked(true);
    }
  }, [relockAllSessions]);

  const refreshSecurityConfig = useCallback(async (): Promise<WorkspaceSecurityConfig> => {
    const cfg = await securityRepo.getSecurityConfig();
    setSecurityConfig(cfg);
    return cfg;
  }, []);

  // Load initial security config from SQLite before children mount sensitive screens
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await securityRepo.getSecurityConfig();
        if (!active) return;
        setSecurityConfig(cfg);
        if (cfg.appLockEnabled && cfg.masterHash && cfg.masterSalt) {
          setIsAppLocked(true);
        } else {
          setIsAppLocked(false);
        }
      } catch (err) {
        console.warn('Failed to load workspace security configuration:', err);
      } finally {
        if (active) {
          setIsSecurityLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Enforce timed auto-relock expiration (1 min, 5 min, 15 min)
  useEffect(() => {
    const timeoutSec = securityConfig.autoRelockSeconds;
    if (timeoutSec <= 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      let notesChanged = false;
      let foldersChanged = false;

      noteExpiryRef.current.forEach((expiresAt, id) => {
        if (now >= expiresAt) {
          noteExpiryRef.current.delete(id);
          notesChanged = true;
        }
      });

      folderExpiryRef.current.forEach((expiresAt, path) => {
        if (now >= expiresAt) {
          folderExpiryRef.current.delete(path);
          foldersChanged = true;
        }
      });

      if (notesChanged) {
        const nextNotes = new Set(noteExpiryRef.current.keys());
        unlockedNoteIdsRef.current = nextNotes;
        setUnlockedNoteIds(nextNotes);
      }
      if (foldersChanged) {
        const nextFolders = new Set(folderExpiryRef.current.keys());
        unlockedFolderPathsRef.current = nextFolders;
        setUnlockedFolderPaths(nextFolders);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [securityConfig.autoRelockSeconds]);

  // AppState background listener (Immediate / On Background / Timed expiry across background)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const cfg = securityConfigRef.current;

      if (nextState === 'background') {
        lastBackgroundedAtRef.current = Date.now();
        // On Immediate (0) or On Background (-1), wipe unlocked sessions & lock app immediately
        if (cfg.autoRelockSeconds === 0 || cfg.autoRelockSeconds === -1) {
          relockAllSessions();
          if (cfg.appLockEnabled && cfg.masterHash && cfg.masterSalt) {
            setIsAppLocked(true);
          }
        }
      } else if (nextState === 'active') {
        const bgAt = lastBackgroundedAtRef.current;
        lastBackgroundedAtRef.current = null;
        if (bgAt && cfg.autoRelockSeconds > 0) {
          const elapsedSec = (Date.now() - bgAt) / 1000;
          if (elapsedSec >= cfg.autoRelockSeconds) {
            relockAllSessions();
            if (cfg.appLockEnabled && cfg.masterHash && cfg.masterSalt) {
              setIsAppLocked(true);
            }
          }
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [relockAllSessions]);

  const setupMasterCredential = useCallback(
    async (params: {
      secret: string;
      credentialKind: CredentialKind;
      hint?: string | null;
      enableAppLock?: boolean;
    }) => {
      const updated = await securityRepo.saveMasterCredential(params);
      setSecurityConfig(updated);
      return updated;
    },
    []
  );

  const clearMasterCredential = useCallback(
    async (options?: { unlockMasterLockedItems?: boolean }) => {
      const updated = await securityRepo.clearMasterCredential(options);
      setSecurityConfig(updated);
      setIsAppLocked(false);
      relockAllSessions();
      return updated;
    },
    [relockAllSessions]
  );

  const setAppLockEnabled = useCallback(async (enabled: boolean) => {
    const updated = await securityRepo.setAppLockEnabled(enabled);
    setSecurityConfig(updated);
    if (!enabled) {
      setIsAppLocked(false);
    }
    return updated;
  }, []);

  const setAutoRelockSeconds = useCallback(async (seconds: number) => {
    const updated = await securityRepo.setAutoRelockSeconds(seconds);
    setSecurityConfig(updated);

    if (seconds > 0) {
      const expiresAt = Date.now() + seconds * 1000;
      unlockedNoteIdsRef.current.forEach((id) => noteExpiryRef.current.set(id, expiresAt));
      unlockedFolderPathsRef.current.forEach((p) => folderExpiryRef.current.set(p, expiresAt));
    } else {
      noteExpiryRef.current.clear();
      folderExpiryRef.current.clear();
    }

    return updated;
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean) => {
    const updated = await securityRepo.setBiometricsEnabled(enabled);
    setSecurityConfig(updated);
    try {
      const cap = await checkBiometricCapability();
      setBiometricCapability(cap);
    } catch {
      // ignore
    }
    return updated;
  }, []);

  const unlockAppWithBiometrics = useCallback(() => {
    securityRateLimiter.recordSuccess('app_lock');
    setIsAppLocked(false);
  }, []);

  const unlockAppWithCredential = useCallback((candidate: string) => {
    const rateKey = 'app_lock';
    const rem = securityRateLimiter.getLockoutRemainingMs(rateKey);
    if (rem > 0) {
      return {
        ok: false,
        lockoutRemainingMs: rem,
        error: `Locked out for ${Math.ceil(rem / 1000)}s.`,
      };
    }

    const cfg = securityConfigRef.current;
    const ok = verifyCredential(candidate, cfg.masterHash, cfg.masterSalt);
    if (ok) {
      securityRateLimiter.recordSuccess(rateKey);
      setIsAppLocked(false);
      return { ok: true };
    }

    const failure = securityRateLimiter.recordFailure(rateKey);
    const remainingAttempts = securityRateLimiter.getRemainingAttempts(rateKey);
    if (failure.lockedOut) {
      return {
        ok: false,
        lockoutRemainingMs: failure.remainingMs,
        error: `Too many failed attempts. Wait ${Math.ceil(failure.remainingMs / 1000)}s.`,
      };
    }

    return {
      ok: false,
      error: `Incorrect Master credential. ${remainingAttempts} attempt${
        remainingAttempts === 1 ? '' : 's'
      } remaining.`,
    };
  }, []);

  const markNoteUnlocked = useCallback((noteId: string) => {
    const timeoutSec = securityConfigRef.current.autoRelockSeconds;
    if (timeoutSec > 0) {
      noteExpiryRef.current.set(noteId, Date.now() + timeoutSec * 1000);
    }
    const next = new Set(unlockedNoteIdsRef.current);
    next.add(noteId);
    unlockedNoteIdsRef.current = next;
    setUnlockedNoteIds(next);
  }, []);

  const markFolderUnlocked = useCallback((folderPath: string) => {
    const clean = normalizeFolderPath(folderPath);
    if (!clean) return;
    const timeoutSec = securityConfigRef.current.autoRelockSeconds;
    if (timeoutSec > 0) {
      folderExpiryRef.current.set(clean, Date.now() + timeoutSec * 1000);
    }
    const next = new Set(unlockedFolderPathsRef.current);
    next.add(clean);
    unlockedFolderPathsRef.current = next;
    setUnlockedFolderPaths(next);
  }, []);

  const relockNoteSession = useCallback((noteId: string) => {
    noteExpiryRef.current.delete(noteId);
    // Dismiss any active verification prompt targeting this note
    setActiveModalRequest((curr) => {
      if (curr?.kind === 'verify' && curr.rateLimitKey === `note:${noteId}`) {
        curr.resolve(false);
        return null;
      }
      return curr;
    });
    if (!unlockedNoteIdsRef.current.has(noteId)) return;
    const next = new Set(unlockedNoteIdsRef.current);
    next.delete(noteId);
    unlockedNoteIdsRef.current = next;
    setUnlockedNoteIds(next);
  }, []);

  const relockNoteOnEditorExit = useCallback(
    (noteId: string) => {
      if (securityConfigRef.current.autoRelockSeconds === 0) {
        relockNoteSession(noteId);
      }
    },
    [relockNoteSession]
  );

  const relockFolderSession = useCallback((folderPath?: string) => {
    if (!folderPath) {
      folderExpiryRef.current.clear();
      unlockedFolderPathsRef.current = new Set();
      setUnlockedFolderPaths(new Set());
      return;
    }

    const clean = normalizeFolderPath(folderPath);
    folderExpiryRef.current.delete(clean);
    if (!unlockedFolderPathsRef.current.has(clean)) return;
    const next = new Set(unlockedFolderPathsRef.current);
    next.delete(clean);
    unlockedFolderPathsRef.current = next;
    setUnlockedFolderPaths(next);
  }, []);

  /**
   * Re-locks unlocked folders when navigating to another folder or root ('All Notes' / null)
   * when autoRelockSeconds === 0, keeping any unlocked ancestor of `nextFolderPath` active.
   */
  const relockFoldersOnSwitch = useCallback((nextFolderPath?: string | null) => {
    if (securityConfigRef.current.autoRelockSeconds !== 0) return;

    const cleanNext = normalizeFolderPath(nextFolderPath);
    const prev = unlockedFolderPathsRef.current;
    if (prev.size === 0) return;
    const next = new Set<string>();
    prev.forEach((unlockedPath) => {
      const keepAsTargetOrAncestor =
        cleanNext.length > 0 &&
        (cleanNext === unlockedPath || cleanNext.startsWith(`${unlockedPath}/`));
      if (keepAsTargetOrAncestor) {
        next.add(unlockedPath);
      } else {
        folderExpiryRef.current.delete(unlockedPath);
      }
    });
    unlockedFolderPathsRef.current = next;
    setUnlockedFolderPaths(next);
  }, []);

  const openVerifyRequest = useCallback(
    (params: {
      title: string;
      subtitle?: string;
      stepLabel?: string;
      lockType: LockType;
      credentialKind?: CredentialKind | null;
      hint?: string | null;
      rateLimitKey: string;
      confirmLabel?: string;
      verifyCandidate: (secret: string) => boolean;
      keepOpenAfterResolve?: boolean;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        const id = modalIdRef.current++;
        setActiveModalRequest({
          id,
          kind: 'verify',
          title: params.title,
          subtitle: params.subtitle,
          stepLabel: params.stepLabel,
          lockType: params.lockType,
          credentialKind: params.credentialKind,
          hint: params.hint,
          rateLimitKey: params.rateLimitKey,
          confirmLabel: params.confirmLabel,
          verifyCandidate: params.verifyCandidate,
          resolve: (ok) => {
            if (!ok || !params.keepOpenAfterResolve) {
              setActiveModalRequest((curr) => (curr?.id === id ? null : curr));
            }
            resolve(ok);
          },
        });
      });
    },
    []
  );

  const promptVerifyTargetCredential = useCallback(
    async (params: {
      title: string;
      subtitle?: string;
      lockType: LockType;
      credentialKind?: CredentialKind | null;
      customHash?: string | null;
      customSalt?: string | null;
      hint?: string | null;
      rateLimitKey: string;
      confirmLabel?: string;
    }): Promise<boolean> => {
      const cfg = securityConfigRef.current;
      const resolvedHint =
        params.lockType === 'master' ? params.hint || cfg.masterHint : params.hint;
      const resolvedKind =
        params.lockType === 'master'
          ? cfg.masterCredentialType
          : params.credentialKind || 'pin';

      return openVerifyRequest({
        title: params.title,
        subtitle: params.subtitle,
        lockType: params.lockType,
        credentialKind: resolvedKind,
        hint: resolvedHint,
        rateLimitKey: params.rateLimitKey,
        confirmLabel: params.confirmLabel,
        verifyCandidate: (candidate) =>
          verifyTargetCredential({
            candidate,
            lockType: params.lockType,
            customHash: params.customHash,
            customSalt: params.customSalt,
            securityConfig: cfg,
          }),
      });
    },
    [openVerifyRequest]
  );

  const promptUnlockFolder = useCallback(
    async (folderOrPath: DBFolder | string, allFolders: DBFolder[]): Promise<boolean> => {
      const targetPath =
        typeof folderOrPath === 'string' ? folderOrPath : folderOrPath.path;
      const folderMap = buildFolderMapByPath(allFolders);
      const blockers = getBlockingLockedFoldersForPath(
        targetPath,
        folderMap,
        unlockedFolderPathsRef.current
      );

      if (blockers.length === 0) return true;

      const cfg = securityConfigRef.current;
      const total = blockers.length;

      for (let i = 0; i < total; i++) {
        const folder = blockers[i];
        const lockType: LockType = folder.lock_type === 'custom' ? 'custom' : 'master';
        const resolvedHint =
          lockType === 'master' ? folder.lock_hint || cfg.masterHint : folder.lock_hint;
        const resolvedKind =
          lockType === 'master'
            ? cfg.masterCredentialType
            : folder.lock_credential_kind || 'pin';

        const ok = await openVerifyRequest({
          title: `Unlock Folder "${folder.name}"`,
          subtitle:
            lockType === 'custom'
              ? 'This folder uses a Custom PIN/Password.'
              : 'Enter your Master Credential to unlock this folder and view its notes.',
          stepLabel: total > 1 ? `Step ${i + 1} of ${total}` : undefined,
          lockType,
          credentialKind: resolvedKind,
          hint: resolvedHint,
          rateLimitKey: `folder:${folder.id}`,
          confirmLabel: 'Unlock Folder',
          keepOpenAfterResolve: i < total - 1,
          verifyCandidate: (candidate) =>
            verifyTargetCredential({
              candidate,
              lockType,
              customHash: folder.lock_hash,
              customSalt: folder.lock_salt,
              securityConfig: cfg,
            }),
        });

        if (!ok) {
          setActiveModalRequest(null);
          return false;
        }
        markFolderUnlocked(folder.path);
      }

      setActiveModalRequest(null);
      return true;
    },
    [markFolderUnlocked, openVerifyRequest]
  );

  const promptUnlockNote = useCallback(
    async (note: NoteItem, allFolders: DBFolder[]): Promise<boolean> => {
      const inspection = inspectNoteLockState(
        note,
        allFolders,
        unlockedNoteIdsRef.current,
        unlockedFolderPathsRef.current
      );

      if (!inspection.isEffectivelyLocked) return true;

      const cfg = securityConfigRef.current;
      const totalSteps =
        inspection.blockingFolders.length + (inspection.isNoteDirectlyLocked ? 1 : 0);
      let currentStep = 0;

      // 1. Unlock any locked parent/ancestor folder(s) first
      for (const folder of inspection.blockingFolders) {
        currentStep++;
        const lockType: LockType = folder.lock_type === 'custom' ? 'custom' : 'master';
        const resolvedHint =
          lockType === 'master' ? folder.lock_hint || cfg.masterHint : folder.lock_hint;
        const resolvedKind =
          lockType === 'master'
            ? cfg.masterCredentialType
            : folder.lock_credential_kind || 'pin';

        const folderOk = await openVerifyRequest({
          title: `Unlock Folder "${folder.name}"`,
          subtitle:
            lockType === 'custom'
              ? `"${note.title || 'Untitled Note'}" is inside locked folder "${folder.path}".`
              : `"${note.title || 'Untitled Note'}" is protected by locked folder "${folder.path}".`,
          stepLabel: totalSteps > 1 ? `Step ${currentStep} of ${totalSteps}` : undefined,
          lockType,
          credentialKind: resolvedKind,
          hint: resolvedHint,
          rateLimitKey: `folder:${folder.id}`,
          confirmLabel: 'Unlock Folder',
          keepOpenAfterResolve: currentStep < totalSteps,
          verifyCandidate: (candidate) =>
            verifyTargetCredential({
              candidate,
              lockType,
              customHash: folder.lock_hash,
              customSalt: folder.lock_salt,
              securityConfig: cfg,
            }),
        });

        if (!folderOk) {
          setActiveModalRequest(null);
          return false;
        }
        markFolderUnlocked(folder.path);
      }

      // 2. If the note itself is individually locked (Master or Custom), verify its own lock
      if (inspection.isNoteDirectlyLocked) {
        currentStep++;
        const noteLockType: LockType = note.lockType === 'custom' ? 'custom' : 'master';
        const resolvedHint =
          noteLockType === 'master' ? note.lockHint || cfg.masterHint : note.lockHint;
        const resolvedKind =
          noteLockType === 'master'
            ? cfg.masterCredentialType
            : note.lockCredentialKind || 'pin';

        const noteOk = await openVerifyRequest({
          title: `Unlock "${note.title || 'Untitled Note'}"`,
          subtitle:
            noteLockType === 'custom'
              ? 'This note is protected with a Custom PIN/Password.'
              : 'Enter your Master Credential to view this note.',
          stepLabel: totalSteps > 1 ? `Step ${currentStep} of ${totalSteps}` : undefined,
          lockType: noteLockType,
          credentialKind: resolvedKind,
          hint: resolvedHint,
          rateLimitKey: `note:${note.id}`,
          confirmLabel: 'Unlock Note',
          keepOpenAfterResolve: false,
          verifyCandidate: (candidate) =>
            verifyTargetCredential({
              candidate,
              lockType: noteLockType,
              customHash: note.lockHash,
              customSalt: note.lockSalt,
              securityConfig: cfg,
            }),
        });

        if (!noteOk) {
          setActiveModalRequest(null);
          return false;
        }
        markNoteUnlocked(note.id);
      }

      setActiveModalRequest(null);
      return true;
    },
    [
      markFolderUnlocked,
      markNoteUnlocked,
      openVerifyRequest,
    ]
  );

  const promptConfigureLock = useCallback(
    async (params: {
      targetLabel: string;
      entityType: 'note' | 'folder' | 'batch_notes';
      initialLockType?: LockType;
      initialHint?: string | null;
    }): Promise<LockTargetPayload | null> => {
      const cfg = securityConfigRef.current;
      const masterExists = Boolean(cfg.masterHash && cfg.masterSalt);

      const modalResult = await new Promise<{
        lockType: LockType;
        credentialKind?: CredentialKind;
        secret?: string;
        hint?: string | null;
        newMasterSetup?: {
          secret: string;
          credentialKind: CredentialKind;
          hint?: string | null;
        };
      } | null>((resolve) => {
        const id = modalIdRef.current++;
        setActiveModalRequest({
          id,
          kind: 'configure_lock',
          targetLabel: params.targetLabel,
          entityType: params.entityType,
          hasMasterConfigured: masterExists,
          masterCredentialType: cfg.masterCredentialType,
          initialLockType: params.initialLockType,
          initialHint: params.initialHint,
          resolve: (res) => {
            setActiveModalRequest((curr) => (curr?.id === id ? null : curr));
            resolve(res);
          },
        });
      });

      if (!modalResult) return null;

      if (modalResult.newMasterSetup) {
        await setupMasterCredential({
          secret: modalResult.newMasterSetup.secret,
          credentialKind: modalResult.newMasterSetup.credentialKind,
          hint: modalResult.newMasterSetup.hint,
        });
      }

      return {
        lockType: modalResult.lockType,
        credentialKind: modalResult.credentialKind,
        secret: modalResult.secret,
        hint: modalResult.hint,
      };
    },
    [setupMasterCredential]
  );

  const promptVerifyMaster = useCallback(
    async (params?: { title?: string; subtitle?: string; confirmLabel?: string }) => {
      const cfg = securityConfigRef.current;
      if (!cfg.masterHash || !cfg.masterSalt) return true;

      return openVerifyRequest({
        title: params?.title || 'Verify Master Credential',
        subtitle:
          params?.subtitle || 'Confirm your current Workspace Master PIN or Password.',
        lockType: 'master',
        credentialKind: cfg.masterCredentialType,
        hint: cfg.masterHint,
        rateLimitKey: 'master_verify',
        confirmLabel: params?.confirmLabel || 'Verify',
        verifyCandidate: (candidate) =>
          verifyCredential(candidate, cfg.masterHash, cfg.masterSalt),
      });
    },
    [openVerifyRequest]
  );

  const promptSetupOrChangeMaster = useCallback(
    async (mode: 'create' | 'change'): Promise<boolean> => {
      const cfg = securityConfigRef.current;

      if (mode === 'change' && cfg.masterHash && cfg.masterSalt) {
        const verified = await openVerifyRequest({
          title: 'Verify Current Master Credential',
          subtitle: 'Required before setting a new Workspace Master PIN or Password.',
          stepLabel: 'Step 1 of 2',
          lockType: 'master',
          credentialKind: cfg.masterCredentialType,
          hint: cfg.masterHint,
          rateLimitKey: 'master_change',
          confirmLabel: 'Next',
          keepOpenAfterResolve: true,
          verifyCandidate: (candidate) =>
            verifyCredential(candidate, cfg.masterHash, cfg.masterSalt),
        });

        if (!verified) {
          setActiveModalRequest(null);
          return false;
        }
      }

      const setupResult = await new Promise<{
        secret: string;
        credentialKind: CredentialKind;
        hint: string | null;
      } | null>((resolve) => {
        const id = modalIdRef.current++;
        setActiveModalRequest({
          id,
          kind: 'setup_master',
          mode,
          initialCredentialKind: cfg.masterCredentialType || 'pin',
          initialHint: mode === 'change' ? cfg.masterHint : null,
          resolve: (res) => {
            setActiveModalRequest((curr) => (curr?.id === id ? null : curr));
            resolve(res);
          },
        });
      });

      if (!setupResult) return false;

      await setupMasterCredential({
        secret: setupResult.secret,
        credentialKind: setupResult.credentialKind,
        hint: setupResult.hint,
      });

      return true;
    },
    [openVerifyRequest, setupMasterCredential]
  );

  const activeUnlockedCount = useMemo(
    () => unlockedNoteIds.size + unlockedFolderPaths.size,
    [unlockedNoteIds, unlockedFolderPaths]
  );

  return (
    <SecurityContext.Provider
      value={{
        securityConfig,
        isSecurityLoading,
        isAppLocked,
        hasMasterConfigured,
        unlockedNoteIds,
        unlockedFolderPaths,
        activeUnlockedCount,
        biometricCapability,
        refreshBiometricCapability,
        refreshSecurityConfig,
        setupMasterCredential,
        clearMasterCredential,
        setAppLockEnabled,
        setAutoRelockSeconds,
        setBiometricsEnabled,
        unlockAppWithCredential,
        unlockAppWithBiometrics,
        lockNow,
        relockAllSessions,
        markNoteUnlocked,
        markFolderUnlocked,
        relockNoteSession,
        relockNoteOnEditorExit,
        relockFolderSession,
        relockFoldersOnSwitch,
        promptUnlockFolder,
        promptUnlockNote,
        promptConfigureLock,
        promptVerifyTargetCredential,
        promptVerifyMaster,
        promptSetupOrChangeMaster,
      }}
    >
      {children}
      <PinPasswordPromptModal
        request={activeModalRequest}
        biometricsEnabled={securityConfig.biometricsEnabled && Boolean(biometricCapability?.isAvailable)}
        biometricName={biometricCapability?.displayName || 'Biometrics'}
      />
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);
