import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import UI from './uiStrings';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Fab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  IconButton,
  Snackbar,
  Alert,
  Autocomplete,
  Box,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PlayArrow, Edit, Delete, Add, Stop, Close, Today, Person } from '@mui/icons-material';

const API_BASE = 'http://localhost:5000/api';
const MEDIA_ORIGIN = 'http://localhost:5000';

/** Keeps overlay text readable when card / sheet opacity is low */
const OVERLAY_TITLE_SHADOW =
  '0 0 2px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.55)';
const OVERLAY_MUTED_SHADOW = '0 1px 3px rgba(0,0,0,0.85), 0 2px 12px rgba(0,0,0,0.5)';

/** Developer FAB + dialog only — purple / slate, separate from schedule dialogs (primary / teal). */
const DEV_ACCENT = '#7c4dff';
const DEV_ACCENT_DARK = '#4527a0';
const DEV_TITLE_GRAD = `linear-gradient(125deg, #311b92 0%, #5e35b1 42%, #4527a0 100%)`;
const DEV_PAPER_BG = '#faf8ff';
const DEV_CONTENT_BG = '#f3e8fd';
const DEV_FOOTER_BG = '#ede7f6';
const DEV_MUTED_TEXT = '#4a148c';

/** Parse stored "HH:MM" / "HH:MM:SS" into a Dayjs time (today’s date is only a carrier for the clock). */
function parseEventAtToDayjs(eventAtStr) {
  if (!eventAtStr || typeof eventAtStr !== 'string') return null;
  const m = eventAtStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return dayjs().hour(h).minute(min).second(0).millisecond(0);
}

/** Same clock key as backend `normalize_event_at_hhmm` for overlay countdown matching. */
function normalizeEventAtHhMm(eventAt) {
  if (eventAt == null || eventAt === '') return '';
  const s = String(eventAt).trim();
  const d = parseEventAtToDayjs(s);
  if (d && d.isValid()) return d.format('HH:mm');
  const parts = s.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Live countdown for overlay; mirrors backend Sinhala phrasing (පැය / මිනිත්තු / තත්පර). */
function formatOverlayCountdownSinhala(eventAt) {
  const key = normalizeEventAtHhMm(eventAt);
  if (!key) return null;
  const [hStr, mStr] = key.split(':');
  const hh = parseInt(hStr, 10);
  const mm = parseInt(mStr, 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const rem = totalSec % 3600;
  const minutes = Math.floor(rem / 60);
  const seconds = rem % 60;
  return `පැය ${hours} මිනිත්තු ${minutes} තත්පර ${seconds}`;
}

const LABEL_PRESETS = [
  'සිනුව නාද කිරීම',
  'දහම් පාසල ආරම්භය',
  'උදෑසන ගාථා සජ්ජායනය',
  'කාලච්ඡේද මාරුවීම',
  'විවේක කාලය ආරම්භය',
  'විවේක කාලය අවසානය',
  'දහම් පාසල් අවසාන ගාථා සජ්ජායනය',
  'දහම් පාසල අවසානය',
];

function App() {
  const [schedules, setSchedules] = useState([]);
  const [status, setStatus] = useState({});
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ event_at: '', label: '', enabled: true, audio_name: '', audio_path: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [audio, setAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingDialog, setPlayingDialog] = useState(false);
  const [timeoutDialog, setTimeoutDialog] = useState(false);
  const [developerDialogOpen, setDeveloperDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [showCountdown, setShowCountdown] = useState(false);
  const [currentPlayingSchedule, setCurrentPlayingSchedule] = useState(null);
  const [isBackendPlaying, setIsBackendPlaying] = useState(false);
  const timeoutIntervalRef = useRef(null);
  const lastPlayTriggerRef = useRef(null);
  const pendingAutoPlayRef = useRef(null);
  const catchUpPlayIdRef = useRef(null);
  const fetchStatusRef = useRef(async () => {});
  const checkTimeoutRef = useRef(null);
  const [isAutoTriggered, setIsAutoTriggered] = useState(false);
  const audioContextRef = useRef(null);
  const webAudioSourceRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [todaysScheduleArm, setTodaysScheduleArm] = useState(false);
  const todaysScheduleArmRef = useRef(false);
  /** Bumps every second while schedule overlay is armed so "next" + countdown use a fresh clock. */
  const [overlayClockTick, setOverlayClockTick] = useState(0);
  const activeSchedulesSorted = useMemo(
    () =>
      [...schedules]
        .filter((s) => s.enabled && s.event_at)
        .sort((a, b) => (a.event_at || '').localeCompare(b.event_at || '')),
    [schedules]
  );

  const nextScheduleAfterNow = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const items = schedules
      .filter((s) => s.enabled && s.event_at)
      .map((s) => {
        const parts = String(s.event_at).split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1] ?? '0', 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return { s, minutes: h * 60 + m };
      })
      .filter(Boolean)
      .filter((x) => x.minutes > currentMinutes)
      .sort((a, b) => a.minutes - b.minutes);

    return items[0]?.s ?? null;
  }, [schedules, overlayClockTick]);

  useEffect(() => {
    if (!todaysScheduleArm) return undefined;
    const id = window.setInterval(() => {
      setOverlayClockTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [todaysScheduleArm]);

  useEffect(() => {
    todaysScheduleArmRef.current = todaysScheduleArm;
  }, [todaysScheduleArm]);

  /* Auto-close dialog only applies while "අද වැඩසටහන" overlay is armed — hide and reset when stopped. */
  useEffect(() => {
    if (todaysScheduleArm) return;
    setTimeoutDialog(false);
    setShowCountdown(false);
    if (timeoutIntervalRef.current) {
      clearInterval(timeoutIntervalRef.current);
      timeoutIntervalRef.current = null;
    }
  }, [todaysScheduleArm]);

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const ensureAudioUnlockedFromUserGesture = async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      showToast(UI.webAudioUnsupported, 'error');
      return false;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AC();
    }
    const ctx = audioContextRef.current;
    try {
      await ctx.resume();
    } catch (e) {
      console.error(e);
      return false;
    }
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      osc.start(t);
      osc.stop(t + 0.02);
    } catch (e) {
      console.error(e);
    }
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    return true;
  };

  const handleStartStopTodaysSchedule = async () => {
    if (todaysScheduleArm) {
      setTodaysScheduleArm(false);
      showToast(UI.scheduleStopped, 'info');
      return;
    }
    const ok = await ensureAudioUnlockedFromUserGesture();
    if (!ok) {
      showToast(UI.scheduleAudioEnableFailed, 'error');
      return;
    }
    const n = activeSchedulesSorted.length;
    if (n === 0) {
      showToast(UI.scheduleAudioNoItems, 'info');
    } else {
      showToast(UI.scheduleAudioReady(n), 'success');
    }
    setTodaysScheduleArm(true);
  };

  useEffect(() => {
    if (!todaysScheduleArm) return;
    setOpen(false);
    setEditing(null);
    setForm({ event_at: '', label: '', enabled: true, audio_name: '', audio_path: '' });
  }, [todaysScheduleArm]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const showTimeoutDialog = () => {
    if (!todaysScheduleArmRef.current) return;
    if (timeoutIntervalRef.current) {
      clearInterval(timeoutIntervalRef.current);
      timeoutIntervalRef.current = null;
    }
    setTimeoutDialog(true);
    setShowCountdown(true);
    setCountdown(15);
    timeoutIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timeoutIntervalRef.current);
          handleExit(); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const askKeepOpen = () => {
    if (!todaysScheduleArmRef.current) return;
    if (!isBackendPlaying) {
      const activeSchedules = schedules.filter(s => s.enabled && s.event_at);
      if (activeSchedules.length === 0) {
        setTimeoutDialog(true);
        setShowCountdown(false);
        clearInterval(timeoutIntervalRef.current);
        timeoutIntervalRef.current = null;
      }
    }
  };

  const checkAndShowTimeoutDialog = () => {
    if (!todaysScheduleArmRef.current) return;
    const activeSchedules = schedules.filter(s => s.enabled && s.event_at);
    if (activeSchedules.length === 0 && !isBackendPlaying) {
      showTimeoutDialog();
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await axios.get(`${API_BASE}/status`);
        setBackendAvailable(true);
        await fetchSchedules();
      } catch (error) {
        setBackendAvailable(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (canCloseApp() && todaysScheduleArmRef.current) {
        showTimeoutDialog();
      }
    }, 60000);

    return () => clearTimeout(timeoutId);
  }, [schedules, isPlaying, isBackendPlaying, audio]);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      void fetchStatusRef.current();
    }, 1000);
    return () => clearInterval(statusInterval);
  }, []);

  // Check 15 seconds after audio finishes if we should show close dialog
  useEffect(() => {
    if (!isAutoTriggered) return undefined;
    const timeoutId = setTimeout(() => {
      if (canCloseApp() && todaysScheduleArmRef.current) {
        showTimeoutDialog();
      }
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [isAutoTriggered, isBackendPlaying, isPlaying, audio, schedules]);

  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${API_BASE}/schedules`);
      setSchedules(res.data);
    } catch (error) {
      showToast(UI.fetchSchedulesError, 'error');
    }
  };

  const handleExit = async () => {
    try {
      await axios.get('http://localhost:5000/exit', { timeout: 8000 });
    } catch (error) {
      console.error('Error exiting backend:', error);
    }

    // Try to close the tab/window (works for script-opened windows; blocked for normal tabs).
    try {
      window.top.close();
    } catch (_) {
      /* ignore */
    }
    try {
      window.close();
    } catch (_) {
      /* ignore */
    }
  };

  const canCloseApp = () => {
    return (
      !isPlaying &&
      !isBackendPlaying &&
      !audio &&
      !hasFutureSchedules()
    );
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`);
      const data = res.data;
      setBackendAvailable(true);
      setStatus(data);
      setIsBackendPlaying(data.playing || false);

      if (!data.playing) {
        catchUpPlayIdRef.current = null;
      }

      if (data.play_trigger && data.play_trigger !== lastPlayTriggerRef.current) {
        lastPlayTriggerRef.current = data.play_trigger;
        setIsAutoTriggered(true);
        if (data.audio_path) {
          const payload = {
            id: data.current_playing,
            label: data.label,
            event_at: data.event_at,
            audio_path: data.audio_path,
          };
          if (!audioUnlockedRef.current) {
            pendingAutoPlayRef.current = payload;
            showToast(UI.scheduleBellTapToEnable, 'warning');
            try {
              await axios.post(`${API_BASE}/stop`);
            } catch (e) {
              console.error(e);
            }
          } else {
            await playAudioFromPath(payload);
          }
        }
      }

      /* Backend says "playing" but no local buffer source — e.g. missed poll, tab background, or failed resume */
      if (
        data.playing &&
        data.audio_path &&
        audioUnlockedRef.current &&
        !webAudioSourceRef.current &&
        data.current_playing &&
        catchUpPlayIdRef.current !== data.current_playing
      ) {
        const ctx = audioContextRef.current;
        if (ctx?.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        try {
          await playAudioFromPath({
            id: data.current_playing,
            label: data.label,
            event_at: data.event_at,
            audio_path: data.audio_path,
          });
          catchUpPlayIdRef.current = data.current_playing;
        } catch (e) {
          console.error('Catch-up playback failed', e);
        }
      }
    } catch (error) {
      setBackendAvailable(false);
      console.error('Error fetching status', error);
    }
  };

  const stopLocalPlaybackOnly = () => {
    if (webAudioSourceRef.current) {
      try {
        webAudioSourceRef.current.stop(0);
      } catch (_) {
        /* already ended */
      }
      webAudioSourceRef.current = null;
    }
    if (audio && typeof audio.pause === 'function') {
      audio.pause();
      audio.currentTime = 0;
    }
    setAudio(null);
    setIsPlaying(false);
  };

  const playAudioFromPath = async ({ id, audio_path, label, event_at }) => {
    pendingAutoPlayRef.current = null;
    stopLocalPlaybackOnly();

    if (!audioUnlockedRef.current) {
      showToast(UI.timedPlaybackNeedsUnlock, 'warning');
      try {
        await axios.post(`${API_BASE}/stop`);
      } catch (e) {
        console.error(e);
      }
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx) {
      showToast(UI.audioNotReady, 'warning');
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.error(e);
      }
    }

    const schedule = {
      id,
      label,
      event_at,
    };
    setCurrentPlayingSchedule(schedule);
    setPlayingDialog(true);

    try {
      const url = `${MEDIA_ORIGIN}${audio_path}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load audio (${res.status})`);
      }
      const raw = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(raw.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      webAudioSourceRef.current = source;

      source.onended = async () => {
        webAudioSourceRef.current = null;
        setIsPlaying(false);
        setAudio(null);
        setPlayingDialog(false);
        setCurrentPlayingSchedule(null);
        catchUpPlayIdRef.current = null;
        try {
          await axios.post(`${API_BASE}/stop`);
        } catch (e) {
          console.error(e);
        }
        try {
          await fetchStatusRef.current();
        } catch (e) {
          console.error(e);
        }
        setTimeout(() => {
          if (canCloseApp()) {
            showTimeoutDialog();
          }
        }, 15000);
      };

      source.start(0);
      setAudio({ kind: 'webaudio' });
      setIsPlaying(true);
      showToast(UI.audioPlaying, 'success');
    } catch (error) {
      console.error('Playback failed:', error);
      webAudioSourceRef.current = null;
      setPlayingDialog(false);
      setCurrentPlayingSchedule(null);
      setIsPlaying(false);
      setAudio(null);
      showToast(UI.playAudioFailed, 'error');
      try {
        await axios.post(`${API_BASE}/stop`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  /** After a scheduled bell, if Web Audio was still locked, replay once the user taps (browser autoplay policy). */
  useEffect(() => {
    const tryPlayPending = async () => {
      const pending = pendingAutoPlayRef.current;
      if (!pending) return;
      const ok = await ensureAudioUnlockedFromUserGesture();
      if (!ok) return;
      pendingAutoPlayRef.current = null;
      await playAudioFromPath(pending);
    };
    const onPointerDown = () => {
      void tryPlayPending();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void tryPlayPending();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('visibilitychange', onVis);
    };
    // playAudioFromPath / ensureAudioUnlocked are stable enough for this global listener pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualPlay = async (scheduleId) => {
    setIsAutoTriggered(false); // ❌ manual
    const unlocked = await ensureAudioUnlockedFromUserGesture();
    if (!unlocked) {
      showToast(UI.enableAudioFailed, 'error');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/play/${scheduleId}`);
      await playAudioFromPath({
        id: res.data.id,
        audio_path: res.data.audio_path,
        label: res.data.label,
        event_at: res.data.event_at,
      });
    } catch (error) {
      showToast(UI.playbackStartError, 'error');
    }
  };

  const stopAudio = async () => {
    catchUpPlayIdRef.current = null;
    if (webAudioSourceRef.current) {
      try {
        webAudioSourceRef.current.stop(0);
      } catch (_) {
        /* already ended */
      }
      webAudioSourceRef.current = null;
    }
    if (audio && typeof audio.pause === 'function') {
      audio.pause();
      audio.currentTime = 0;
    }
    setAudio(null);
    setIsPlaying(false);
    setPlayingDialog(false);
    setCurrentPlayingSchedule(null);
    try {
      await axios.post(`${API_BASE}/stop`);
    } catch (error) {
      console.error('Error stopping audio on backend', error);
    }
  };

  const testPlay = async () => {
    if (form.audio_path) {
      const unlocked = await ensureAudioUnlockedFromUserGesture();
      if (!unlocked) {
        showToast(UI.enableAudioRetry, 'error');
        return;
      }
      try {
        const res = await axios.post(`${API_BASE}/test-play`, {
          audio_path: form.audio_path,
          label: form.label || UI.testAudioDefaultLabel,
          event_at: form.event_at || '',
        });
        await playAudioFromPath({
          id: res.data.id,
          audio_path: res.data.audio_path,
          label: res.data.label,
          event_at: res.data.event_at,
        });
      } catch (error) {
        showToast(UI.testPlayError, 'error');
      }
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await axios.post(`${API_BASE}/upload-audio`, formData);
        setForm({ ...form, audio_name: res.data.audio_name, audio_path: res.data.audio_path });
      } catch (error) {
        showToast(UI.uploadError, 'error');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const scheduleData = { ...form };
      if (editing) {
        await axios.put(`${API_BASE}/schedules/${editing.id}`, scheduleData);
        showToast(UI.scheduleUpdated);
      } else {
        await axios.post(`${API_BASE}/schedules`, scheduleData);
        showToast(UI.scheduleCreated);
      }
      await fetchSchedules();
      setOpen(false);
      setEditing(null);
      setForm({ event_at: '', label: '', enabled: true, audio_name: '', audio_path: '' });
    } catch (error) {
      showToast(UI.saveScheduleError, 'error');
    }
  };

  const handleEdit = (schedule) => {
    setEditing(schedule);
    setForm({
      ...schedule,
      event_at: schedule.event_at
    });
    setOpen(true);
  };

  const handleAddSchedule = () => {
    setEditing(null);
    setForm({ event_at: '', label: '', enabled: true, audio_name: '', audio_path: '' });
    setOpen(true);
  };

  const hasFutureSchedules = () => {
    const now = new Date();

    return schedules.some((s) => {
      if (!s.enabled || !s.event_at) return false;

      const parts = String(s.event_at).split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] ?? '0', 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return false;
      const scheduleTime = new Date();
      scheduleTime.setHours(h, m, 0, 0);

      return scheduleTime > now;
    });
  };

  /* After add/update/delete, re-evaluate auto-close: dismiss dialog if schedules now justify staying open. */
  useEffect(() => {
    if (!timeoutDialog) return;
    const hasAnyEnabledSlot = schedules.some((s) => s.enabled && s.event_at);
    if (!canCloseApp() || (!showCountdown && hasAnyEnabledSlot)) {
      setTimeoutDialog(false);
      setShowCountdown(false);
      if (timeoutIntervalRef.current) {
        clearInterval(timeoutIntervalRef.current);
        timeoutIntervalRef.current = null;
      }
    }
  }, [schedules, timeoutDialog, showCountdown, isPlaying, isBackendPlaying, audio]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/schedules/${id}`);
      await fetchSchedules();
      showToast(UI.scheduleDeleted);
    } catch (error) {
      showToast(UI.deleteScheduleError, 'error');
    }
  };

  const handleToggle = async (schedule) => {
    try {
      await axios.put(`${API_BASE}/schedules/${schedule.id}`, { ...schedule, enabled: !schedule.enabled });
      await fetchSchedules();
    } catch (error) {
      showToast(UI.toggleScheduleError, 'error');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) {
      return timeStr || '';
    }
    const [hour, minute] = timeStr.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'ප.ව.' : 'පෙ.ව.';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minute} ${ampm}`;
  };

  const scheduleOverlayDisplay = useMemo(() => {
    const playingNow =
      (isPlaying || isBackendPlaying) &&
      (Boolean(currentPlayingSchedule?.label) || Boolean(status.playing && status.label));

    if (playingNow) {
      const label = currentPlayingSchedule?.label || status.label || '';
      const eventAt = currentPlayingSchedule?.event_at ?? status.event_at ?? '';
      return { type: 'now', label, event_at: eventAt };
    }
    if (nextScheduleAfterNow) {
      return {
        type: 'next',
        label: nextScheduleAfterNow.label,
        event_at: nextScheduleAfterNow.event_at,
      };
    }
    return { type: 'idle' };
  }, [
    isPlaying,
    isBackendPlaying,
    currentPlayingSchedule,
    status.playing,
    status.label,
    status.event_at,
    nextScheduleAfterNow,
  ]);

  const overlayNextCountdown =
    scheduleOverlayDisplay.type === 'next' && scheduleOverlayDisplay.event_at
      ? formatOverlayCountdownSinhala(scheduleOverlayDisplay.event_at)
      : null;

  fetchStatusRef.current = fetchStatus;

  if (!backendAvailable) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Card sx={{ p: 4 }}>
          <CardContent>
            <Typography variant="h5" color="error" gutterBottom>
              {UI.backendUnavailableTitle}
            </Typography>
            <Typography>{UI.backendUnavailableBody}</Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2.5,
            flexWrap: 'wrap',
            gap: 1.5,
            py: 2,
            px: { xs: 2, sm: 3 },
            borderRadius: 3,
            background: (t) =>
              `linear-gradient(115deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 42%, #00838f 100%)`,
            boxShadow: '0 10px 40px rgba(25, 118, 210, 0.35)',
          }}
        >
          <Typography
            variant="h4"
            sx={{
              color: 'common.white',
              fontWeight: 800,
              letterSpacing: -0.5,
              textShadow: '0 2px 12px rgba(0,0,0,0.25)',
            }}
          >
            {UI.appTitle}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Close />}
            onClick={handleExit}
            sx={{
              bgcolor: (t) => alpha(t.palette.error.main, 0.92),
              color: 'common.white',
              '&:hover': { bgcolor: 'error.dark' },
              boxShadow: '0 4px 14px rgba(211, 47, 47, 0.45)',
            }}
          >
            {UI.closeApplication}
          </Button>
        </Box>

      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          overflow: 'hidden',
          borderLeft: 6,
          borderColor: 'primary.main',
          background: (t) =>
            `linear-gradient(145deg, ${alpha(t.palette.primary.main, 0.08)} 0%, ${alpha(t.palette.secondary.main, 0.05)} 55%, ${t.palette.background.paper} 100%)`,
          boxShadow: (t) => `0 4px 24px ${alpha(t.palette.primary.main, 0.12)}`,
        }}
      >
        <CardContent sx={{ py: 2.5 }}>
          <Typography variant="h6" sx={{ color: 'primary.dark', fontWeight: 700 }}>
            {status.current_time}
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.primary' }}>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>{UI.nextEvent} </Box>
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
              {status.next_event || UI.none}
            </Box>
          </Typography>
          <Typography sx={{ mt: 0.5 }}>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>{UI.timeRemaining} </Box>
            <Box component="span" sx={{ color: 'secondary.dark', fontWeight: 600 }}>
              {status.time_remaining || UI.notApplicable}
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
            {UI.hintOneClick}
          </Typography>
            {!audioUnlocked && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }} variant="outlined">
              {UI.alertAudioNotEnabled}
            </Alert>
          )}
          {audioUnlocked && (
            <Typography variant="body2" sx={{ mt: 1.5, color: 'success.dark', fontWeight: 600 }}>
              {UI.audioEnabledKeepTab}
            </Typography>
          )}
          {todaysScheduleArm && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }} variant="filled">
              {UI.editingPaused}
            </Alert>
          )}
          <Typography
            variant="body2"
            sx={{
              mt: 1.5,
              fontWeight: 600,
              color: isPlaying ? 'success.main' : 'text.secondary',
            }}
          >
            {UI.audioStatus} {isPlaying ? UI.playingNow : UI.idle}
          </Typography>
        </CardContent>
      </Card>

      <Box display="flex" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Button
          variant={todaysScheduleArm ? 'contained' : 'contained'}
          color={todaysScheduleArm ? 'secondary' : 'success'}
          startIcon={todaysScheduleArm ? <Stop /> : <Today />}
          onClick={handleStartStopTodaysSchedule}
          sx={{
            boxShadow: (t) =>
              todaysScheduleArm
                ? `0 4px 18px ${alpha(t.palette.secondary.main, 0.45)}`
                : `0 4px 18px ${alpha(t.palette.success.main, 0.4)}`,
            fontWeight: 700,
          }}
        >
          {todaysScheduleArm ? UI.stopTodaysSchedule : UI.startTodaysSchedule}
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={handleAddSchedule}
          disabled={todaysScheduleArm}
          sx={{ fontWeight: 700, boxShadow: (t) => `0 4px 16px ${alpha(t.palette.primary.main, 0.35)}` }}
        >
          {UI.addSchedule}
        </Button>
      </Box>

      <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
        <TableContainer
          component={Paper}
          sx={{
            pointerEvents: todaysScheduleArm ? 'none' : 'auto',
            opacity: 1,
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: (t) => `0 2px 16px ${alpha(t.palette.common.black, 0.08)}`,
          }}
        >
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  background: (t) =>
                    `linear-gradient(90deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 55%, #00695c 100%)`,
                }}
              >
                <TableCell sx={{ color: 'common.white', fontWeight: 700, borderBottom: 'none' }}>{UI.colTime}</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 700, borderBottom: 'none' }}>{UI.colLabel}</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 700, borderBottom: 'none' }}>{UI.colAudio}</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 700, borderBottom: 'none' }}>{UI.colStatus}</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 700, borderBottom: 'none' }}>{UI.colActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((schedule, index) => (
                <TableRow
                  key={schedule.id}
                  hover
                  sx={{
                    bgcolor: (t) =>
                      currentPlayingSchedule?.id === schedule.id
                        ? alpha(t.palette.success.main, 0.14)
                        : index % 2 === 0
                          ? alpha(t.palette.primary.main, 0.03)
                          : 'transparent',
                    '&:hover': {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.07),
                    },
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, color: 'primary.dark' }}>{formatTime(schedule.event_at)}</TableCell>
                  <TableCell>{schedule.label}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{schedule.audio_name}</TableCell>
                  <TableCell>
                    <Box
                      component="span"
                      sx={{
                        px: 1.25,
                        py: 0.35,
                        borderRadius: 10,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        bgcolor: (t) => (schedule.enabled ? alpha(t.palette.success.main, 0.2) : alpha(t.palette.grey[500], 0.2)),
                        color: schedule.enabled ? 'success.dark' : 'text.secondary',
                      }}
                    >
                      {schedule.enabled ? UI.statusActive : UI.statusInactive}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(schedule)}><Edit /></IconButton>
                    <IconButton onClick={() => handleDelete(schedule.id)}><Delete /></IconButton>
                    <IconButton onClick={() => manualPlay(schedule.id)} disabled={!schedule.audio_path || !schedule.enabled} aria-label={UI.ariaPlaySchedule}>
                      <PlayArrow />
                    </IconButton>
                    {currentPlayingSchedule?.id === schedule.id ? (
                      <IconButton onClick={stopAudio} aria-label={UI.ariaStopSchedule}>
                        <Stop />
                      </IconButton>
                    ) : null}
                    <Checkbox checked={schedule.enabled} onChange={() => handleToggle(schedule)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {todaysScheduleArm && (
          <Box
            role="presentation"
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              textAlign: 'center',
              /* Light scrim so table rows stay visible; center card stays opaque for readability */
              bgcolor: (t) => alpha(t.palette.common.black, 0.22),
              backgroundImage: (t) =>
                `linear-gradient(155deg, ${alpha('#1a237e', 0.18)} 0%, ${alpha(t.palette.common.black, 0.2)} 50%, ${alpha('#004d40', 0.16)} 100%)`,
              backdropFilter: 'blur(4px) saturate(1.05)',
              WebkitBackdropFilter: 'blur(4px) saturate(1.05)',
            }}
          >
            <Stack
              spacing={1.75}
              alignItems="center"
              sx={{
                maxWidth: 600,
                width: '100%',
                px: { xs: 2.75, sm: 4 },
                py: { xs: 3, sm: 3.5 },
                borderRadius: 3,
                border: '3px solid',
                borderColor: (t) => alpha(t.palette.common.white, 0.4),
                bgcolor: alpha('#070b14', 0.97),
                backgroundImage: (theme) =>
                  `linear-gradient(165deg, ${alpha('#1a237e', 0.98)} 0%, ${alpha('#0d1b2a', 0.99)} 50%, ${alpha('#006064', 0.92)} 100%)`,
                boxShadow:
                  '0 28px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              {scheduleOverlayDisplay.type === 'now' && (
                <>
                  <Typography
                    variant="overline"
                    sx={{
                      color: '#fff9c4',
                      letterSpacing: 5,
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      lineHeight: 1.4,
                      textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 20px rgba(255,245,157,0.45)`,
                    }}
                  >
                    {UI.overlayNowPlaying}
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      color: '#ffffff',
                      fontWeight: 800,
                      textShadow: OVERLAY_TITLE_SHADOW,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                      fontSize: { xs: '1.35rem', sm: '1.85rem' },
                    }}
                  >
                    {scheduleOverlayDisplay.label || '—'}
                  </Typography>
                  {scheduleOverlayDisplay.event_at ? (
                    <Typography
                      variant="h5"
                      sx={{
                        color: '#b2ebf2',
                        fontWeight: 800,
                        lineHeight: 1.4,
                        textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 12px rgba(128,222,234,0.35)`,
                      }}
                    >
                      {formatTime(scheduleOverlayDisplay.event_at)}
                    </Typography>
                  ) : null}
                </>
              )}
              {scheduleOverlayDisplay.type === 'next' && (
                <>
                  <Typography
                    variant="overline"
                    sx={{
                      color: '#b3e5fc',
                      letterSpacing: 5,
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      lineHeight: 1.4,
                      textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 18px rgba(128,216,255,0.45)`,
                    }}
                  >
                    {UI.overlayUpNext}
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      color: '#ffffff',
                      fontWeight: 800,
                      textShadow: OVERLAY_TITLE_SHADOW,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                      fontSize: { xs: '1.35rem', sm: '1.85rem' },
                    }}
                  >
                    {scheduleOverlayDisplay.label}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#c8e6c9',
                      fontWeight: 800,
                      lineHeight: 1.4,
                      textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 12px rgba(200,230,201,0.35)`,
                    }}
                  >
                    {formatTime(scheduleOverlayDisplay.event_at)}
                  </Typography>
                  {overlayNextCountdown ? (
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{
                        color: '#fce4ec',
                        fontWeight: 700,
                        mt: 0.25,
                        lineHeight: 1.45,
                        fontSize: { xs: '1rem', sm: '1.125rem' },
                        textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 10px rgba(252,228,236,0.35)`,
                      }}
                    >
                      {overlayNextCountdown}
                    </Typography>
                  ) : null}
                </>
              )}
              {scheduleOverlayDisplay.type === 'idle' && (
                <>
                  <Typography
                    variant="overline"
                    sx={{
                      color: '#cfd8dc',
                      letterSpacing: 4,
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      lineHeight: 1.4,
                      textShadow: OVERLAY_MUTED_SHADOW,
                    }}
                  >
                    {UI.overlayNoNextEventHeading}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#ffffff',
                      fontWeight: 800,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                      textShadow: OVERLAY_TITLE_SHADOW,
                      fontSize: { xs: '1.25rem', sm: '1.65rem' },
                    }}
                  >
                    {UI.overlayNoNextEventBody}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: '#e0e0e0',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      textShadow: OVERLAY_MUTED_SHADOW,
                      fontSize: '1rem',
                    }}
                  >
                    {UI.overlayNoMoreToday}
                  </Typography>
                  {status.current_time ? (
                    <Typography
                      variant="body1"
                      sx={{
                        color: '#90caf9',
                        fontWeight: 700,
                        mt: 0.5,
                        lineHeight: 1.45,
                        fontSize: '1.05rem',
                        textShadow: `${OVERLAY_MUTED_SHADOW}, 0 0 10px rgba(144,202,249,0.35)`,
                      }}
                    >
                      {status.current_time}
                    </Typography>
                  ) : null}
                </>
              )}
            </Stack>
          </Box>
        )}
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: (t) => ({
            borderRadius: 3,
            overflow: 'hidden',
            border: 'none',
            borderLeft: `6px solid ${t.palette.primary.main}`,
            bgcolor: t.palette.grey[50],
            backgroundImage: 'none',
            boxShadow: `0 12px 40px ${alpha(t.palette.common.black, 0.14)}, 0 2px 12px ${alpha(t.palette.primary.main, 0.12)}`,
          }),
        }}
      >
        <DialogTitle
          sx={(t) => ({
            m: 0,
            py: 2,
            px: 2.5,
            background: `linear-gradient(115deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 42%, #00838f 100%)`,
            color: t.palette.common.white,
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: -0.3,
            textShadow: '0 2px 10px rgba(0,0,0,0.25)',
          })}
        >
          {editing ? UI.dialogEditSchedule : UI.dialogAddSchedule}
        </DialogTitle>
        <DialogContent sx={(t) => ({ pt: 2.5, px: 2.5, pb: 1, bgcolor: t.palette.grey[50] })}>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                display="block"
                gutterBottom
              >
                {UI.whenToPlay}
              </Typography>
              <TimePicker
                value={parseEventAtToDayjs(form.event_at)}
                onChange={(newValue) => {
                  setForm({
                    ...form,
                    event_at: newValue && newValue.isValid() ? newValue.format('HH:mm') : '',
                  });
                }}
                format="hh:mm A"
                ampm
                minutesStep={1}
                /* MUI default is timeSteps.minutes = 5 → only 0,5,10,… in the clock list */
                timeSteps={{ hours: 1, minutes: 1 }}
                views={['hours', 'minutes']}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'dense',
                    helperText: UI.timePickerHelper,
                    inputProps: { 'aria-label': UI.timePickerAria },
                    sx: (t) => ({
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: t.palette.common.white,
                        '&:hover fieldset': { borderColor: t.palette.primary.main },
                        '&.Mui-focused fieldset': { borderColor: t.palette.primary.dark, borderWidth: 2 },
                      },
                    }),
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                display="block"
                gutterBottom
              >
                {UI.fieldLabel}
              </Typography>
              <Autocomplete
                freeSolo
                options={LABEL_PRESETS}
                value={form.label}
                onInputChange={(event, newInputValue) => {
                  setForm({ ...form, label: newInputValue });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={UI.nameInList}
                    placeholder={UI.namePlaceholder}
                    fullWidth
                    margin="dense"
                    sx={(t) => ({
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: t.palette.common.white,
                        '&:hover fieldset': { borderColor: t.palette.primary.main },
                        '&.Mui-focused fieldset': { borderColor: t.palette.primary.dark, borderWidth: 2 },
                      },
                    })}
                  />
                )}
              />
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                display="block"
                gutterBottom
              >
                {UI.soundFile}
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                component="label"
                sx={(t) => ({
                  alignSelf: 'flex-start',
                  fontWeight: 700,
                  borderRadius: 2,
                  borderWidth: 2,
                  px: 2,
                  bgcolor: t.palette.common.white,
                  '&:hover': { borderWidth: 2, bgcolor: t.palette.grey[100] },
                })}
              >
                {UI.chooseAudioFile}
                <input type="file" accept="audio/*" hidden onChange={handleFileChange} />
              </Button>
              {form.audio_name ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {UI.selectedFile} {form.audio_name}
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  {UI.audioFormatsHint}
                </Typography>
              )}
            </Box>
            {form.audio_path && (
              <Box>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                  display="block"
                  gutterBottom
                >
                  {UI.preview}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {UI.testPlayHint}
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={testPlay}
                  disabled={!backendAvailable || isPlaying}
                  sx={{ fontWeight: 700, borderRadius: 2, borderWidth: 2 }}
                >
                  {UI.testPlay}
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<Stop />}
                  onClick={stopAudio}
                  sx={{ ml: 1, fontWeight: 700, borderRadius: 2, borderWidth: 2 }}
                  disabled={!backendAvailable || !isPlaying}
                >
                  {UI.stop}
                </Button>
              </Box>
            )}
            <FormControlLabel
              sx={(t) => ({
                alignItems: 'flex-start',
                ml: 0,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: t.palette.common.white,
                border: `1px solid ${t.palette.primary.light}`,
                boxShadow: `0 1px 3px ${alpha(t.palette.common.black, 0.06)}`,
              })}
              control={
                <Checkbox
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'text.primary', pt: 0.25 }}>
                  {UI.enabled}
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={(t) => ({
            px: 2.5,
            py: 2,
            gap: 1,
            borderTop: `1px solid ${t.palette.divider}`,
            bgcolor: t.palette.grey[100],
          })}
        >
          <Button
            onClick={() => setOpen(false)}
            variant="outlined"
            color="primary"
            sx={(t) => ({ fontWeight: 700, borderRadius: 2, borderWidth: 2 })}
          >
            {UI.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            sx={(t) => ({
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: `0 4px 16px ${alpha(t.palette.primary.main, 0.4)}`,
            })}
          >
            {UI.save}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>

      <Dialog
        open={playingDialog}
        onClose={() => {}}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: (t) => ({
            borderRadius: 3,
            overflow: 'hidden',
            border: 'none',
            borderLeft: `6px solid ${t.palette.primary.main}`,
            bgcolor: t.palette.grey[50],
            backgroundImage: 'none',
            boxShadow: `0 12px 40px ${alpha(t.palette.common.black, 0.14)}, 0 2px 12px ${alpha(t.palette.primary.main, 0.12)}`,
          }),
        }}
      >
        <DialogTitle
          sx={(t) => ({
            m: 0,
            py: 2,
            px: 2.5,
            background: `linear-gradient(115deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 42%, #00838f 100%)`,
            color: t.palette.common.white,
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: -0.3,
            textShadow: '0 2px 10px rgba(0,0,0,0.25)',
          })}
        >
          {UI.playingDialogTitle}
        </DialogTitle>
        <DialogContent sx={(t) => ({ pt: 2.5, px: 2.5, pb: 1, bgcolor: t.palette.grey[50] })}>
          <Stack spacing={2}>
            <Box>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                display="block"
                gutterBottom
              >
                {UI.playingLabel.replace(/[:：]\s*$/, '')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600, lineHeight: 1.5 }}>
                {currentPlayingSchedule?.label || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.2, color: 'primary.dark', fontWeight: 700 }}
                display="block"
                gutterBottom
              >
                {UI.playingTime.replace(/[:：]\s*$/, '')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {currentPlayingSchedule ? formatTime(currentPlayingSchedule.event_at) : '—'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={(t) => ({
            px: 2.5,
            py: 2,
            gap: 1,
            borderTop: `1px solid ${t.palette.divider}`,
            bgcolor: t.palette.grey[100],
          })}
        >
          <Button
            onClick={stopAudio}
            variant="contained"
            color="error"
            sx={(t) => ({
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: `0 4px 16px ${alpha(t.palette.error.main, 0.35)}`,
            })}
          >
            {UI.stopAudio}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={timeoutDialog && todaysScheduleArm}
        onClose={() => {}}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: (t) => ({
            borderRadius: 3,
            overflow: 'hidden',
            border: 'none',
            borderLeft: `6px solid ${t.palette.primary.main}`,
            bgcolor: t.palette.grey[50],
            backgroundImage: 'none',
            boxShadow: `0 12px 40px ${alpha(t.palette.common.black, 0.14)}, 0 2px 12px ${alpha(t.palette.primary.main, 0.12)}`,
          }),
        }}
      >
        <DialogTitle
          sx={(t) => ({
            m: 0,
            py: 2,
            px: 2.5,
            background: `linear-gradient(115deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 42%, #00838f 100%)`,
            color: t.palette.common.white,
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: -0.3,
            textShadow: '0 2px 10px rgba(0,0,0,0.25)',
          })}
        >
          {UI.noActiveSchedulesTitle}
        </DialogTitle>
        <DialogContent sx={(t) => ({ pt: 2.5, px: 2.5, pb: 1, bgcolor: t.palette.grey[50] })}>
          {showCountdown ? (
            <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.6, fontWeight: 500 }}>
              {UI.closeCountdown(countdown)}
            </Typography>
          ) : (
            <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.6, fontWeight: 500 }}>
              {UI.keepAppOpenQuestion}
            </Typography>
          )}
        </DialogContent>
        <DialogActions
          sx={(t) => ({
            px: 2.5,
            py: 2,
            gap: 1,
            borderTop: `1px solid ${t.palette.divider}`,
            bgcolor: t.palette.grey[100],
          })}
        >
          <Button
            onClick={() => {
              setTimeoutDialog(false);
              clearInterval(timeoutIntervalRef.current);
              timeoutIntervalRef.current = null;
              clearTimeout(checkTimeoutRef.current);
              setTimeout(() => {
                askKeepOpen();
              }, 120000);
            }}
            variant="outlined"
            color="primary"
            sx={(t) => ({ fontWeight: 700, borderRadius: 2, borderWidth: 2 })}
          >
            {UI.keepOpen}
          </Button>
        </DialogActions>
      </Dialog>

      <Fab
        variant="extended"
        size="small"
        aria-label={UI.developerButton}
        onClick={() => setDeveloperDialogOpen(true)}
        sx={(t) => ({
          position: 'fixed',
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: t.zIndex.modal - 1,
          fontWeight: 700,
          textTransform: 'none',
          letterSpacing: 0.2,
          bgcolor: DEV_ACCENT_DARK,
          color: '#fff',
          '&:hover': { bgcolor: '#311b92' },
          boxShadow: `0 6px 22px ${alpha(DEV_ACCENT_DARK, 0.55)}`,
        })}
      >
        <Person sx={{ mr: 0.75 }} aria-hidden />
        {UI.developerButton}
      </Fab>

      <Dialog
        open={developerDialogOpen}
        onClose={() => setDeveloperDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: 'none',
            borderLeft: `6px solid ${DEV_ACCENT}`,
            bgcolor: DEV_PAPER_BG,
            backgroundImage: 'none',
            boxShadow: `0 16px 48px ${alpha('#311b92', 0.2)}, 0 2px 12px ${alpha(DEV_ACCENT, 0.25)}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            py: 2,
            px: 2.5,
            background: DEV_TITLE_GRAD,
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: -0.2,
            textShadow: '0 2px 12px rgba(0,0,0,0.35)',
          }}
        >
          {UI.developerDialogTitle}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, px: 2.5, pb: 1, bgcolor: DEV_CONTENT_BG }}>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1.2, color: DEV_MUTED_TEXT, fontWeight: 700 }} display="block" gutterBottom>
                {UI.developerNameLabel}
              </Typography>
              <Typography variant="body1" sx={{ color: '#1a1a2e', fontWeight: 600, lineHeight: 1.5 }}>
                {UI.developerNameValue}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1.2, color: DEV_MUTED_TEXT, fontWeight: 700 }} display="block" gutterBottom>
                {UI.developerEmailLabel}
              </Typography>
              <Typography variant="body1" sx={{ color: '#1a1a2e', fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-all' }}>
                {UI.developerEmailValue}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1.2, color: DEV_MUTED_TEXT, fontWeight: 700 }} display="block" gutterBottom>
                {UI.developerPhoneLabel}
              </Typography>
              <Typography variant="body1" sx={{ color: '#1a1a2e', fontWeight: 600, lineHeight: 1.5 }}>
                {UI.developerPhoneValue}
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1.2, color: DEV_MUTED_TEXT, fontWeight: 700 }} display="block" gutterBottom>
                {UI.developerPositionLabel}
              </Typography>
              <Typography variant="body1" sx={{ color: '#1a1a2e', fontWeight: 600, lineHeight: 1.5 }}>
                {UI.developerPositionValue}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: 2.5,
            py: 2,
            gap: 1,
            borderTop: `1px solid ${alpha(DEV_ACCENT_DARK, 0.15)}`,
            bgcolor: DEV_FOOTER_BG,
          }}
        >
          <Button
            onClick={() => setDeveloperDialogOpen(false)}
            variant="contained"
            sx={{
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              bgcolor: DEV_ACCENT_DARK,
              color: '#fff',
              boxShadow: `0 4px 18px ${alpha(DEV_ACCENT_DARK, 0.45)}`,
              '&:hover': { bgcolor: '#311b92', boxShadow: `0 6px 20px ${alpha('#311b92', 0.5)}` },
            }}
          >
            {UI.developerClose}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;