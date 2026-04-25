/**
 * සිංහල පෙළ — දහම් පාසල් ශ්‍රව්‍ය කළමනාකරණ පද්ධතිය
 * User-visible strings only (API paths unchanged).
 */
import { DEFAULT_LOCALE } from '@mui/x-date-pickers/locales/enUS';

/** MUI TimePicker action bar + toolbar (merge English defaults, override key labels). */
export const pickerLocaleText = {
  ...DEFAULT_LOCALE,
  cancelButtonLabel: 'අවලංගු',
  clearButtonLabel: 'හිස් කරන්න',
  okButtonLabel: 'තහවුරු',
  timePickerToolbarTitle: 'වේලාව තෝරන්න',
};

const UI = {
  // Toasts
  webAudioUnsupported: 'මෙම බ්‍රව්සරයේ Web Audio සහාය නොමැත.',
  scheduleStopped: 'අද වැඩසටහන නැවතුණි — වැඩසටහන නැවත සංස්කරණය කළ හැක.',
  scheduleAudioEnableFailed: 'කාලසටහන හඬ සක්‍රිය කළ නොහැක.',
  scheduleAudioNoItems:
    'හඬ සක්‍රියයි. සිනු සඳහා කාලසටහන එක් කරන්න හෝ සක්‍රිය කරන්න.',
  scheduleAudioReady: (n) =>
    `හඬ සක්‍රියයි — ක්‍රියාකාරී වේලා ${n} ක් ඉතුරුයි. මෙම ටැබය විවෘත තබන්න.`,
  fetchSchedulesError: 'කාලසටහන් ලබා ගැනීමේ දෝෂයකි.',
  timedPlaybackNeedsUnlock:
    'කාල නාදයට පළමුව හඬ සක්‍රිය කළ යුතුය. අද වැඩසටහන ආරම්භ කරන්න හෝ නාද / පරීක්ෂණ නාද එකක් ඔබන්න.',
  /** Shown when a scheduled bell fired but the browser has not unlocked Web Audio yet. */
  scheduleBellTapToEnable:
    'සිනු වේලාවයි — හඬ සක්‍රිය නැත. මෙම පිටුව තුළ වරක් ඔබන්න හෝ අද වැඩසටහන ආරම්භ කරන්න; පසුව නාදය නැවත උත්සාහ වේ.',
  audioNotReady: 'හඬ සූදානම් නැත. අද වැඩසටහන හෝ වරක් නාද කරන්න.',
  audioPlaying: 'නාද වේ.',
  playAudioFailed: 'නාද කළ නොහැක. ගොනුව සහ මෙම ටැබය පරීක්ෂා කරන්න.',
  enableAudioFailed: 'හඬ සක්‍රිය කළ නොහැක. නැවත උත්සාහ කරන්න හෝ අද වැඩසටහන භාවිතා කරන්න.',
  playbackStartError: 'සේවාදායකයෙන් නාද ආරම්භයේ දෝෂයකි.',
  enableAudioRetry: 'හඬ සක්‍රිය කළ නොහැක. නැවත උත්සාහ කරන්න.',
  testPlayError: 'පරීක්ෂණ නාදයේ දෝෂයකි.',
  uploadError: 'ගොනුව උඩුගත කිරීමේ දෝෂයකි.',
  scheduleUpdated: 'කාලසටහන යාවත්කාලීන විය.',
  scheduleCreated: 'කාලසටහන එක් කරන ලදී.',
  saveScheduleError: 'කාලසටහන සුරැකීමේ දෝෂයකි.',
  scheduleDeleted: 'කාලසටහන මකන ලදී.',
  deleteScheduleError: 'කාලසටහන මකා දැමීමේ දෝෂයකි.',
  toggleScheduleError: 'කාලසටහන යාවත්කාලීන කිරීමේ දෝෂයකි.',

  // Backend offline
  backendUnavailableTitle: 'සේවාදායකය ලබා ගත නොහැක',
  backendUnavailableBody: 'ආයෙත් සේවාදායකය ආරම්භ කර උත්සාහ කරන්න.',

  // Header / actions
  appTitle: 'දහම් පාසල් ශ්‍රව්‍ය කළමනාකරණ පද්ධතිය',
  closeApplication: 'යෙදුම වසන්න',

  // Status card
  nextEvent: 'ඊළඟ අවස්ථාව:',
  none: 'නැත',
  timeRemaining: 'ඉතිරිව ඇති කාලය:',
  notApplicable: '—',
  hintOneClick:
    'එක් එකතුවක් කාල නාදය සක්‍රිය කරයි: අද වැඩසටහන ආරම්භය (උදෑසන නිර්දේශිත), හෝ පේළියේ නාද, හෝ එක් කිරීම/සංස්කරණයේ පරීක්ෂණ නාද.',
  alertAudioNotEnabled:
    'කාල නාදය තවම සක්‍රිය නැත. අද වැඩසටහන ආරම්භ කරන්න',
  audioEnabledKeepTab: 'කාල නාදය සක්‍රියයි ',
  editingPaused:
    'සංස්කරණය විරාමයි — ලැයිස්තුව වෙනස් කිරීමට අද වැඩසටහන නවත්වන්න ඔබන්න.',
  audioStatus: 'ශ්‍රව්‍ය තත්වය:',
  playingNow: 'දැන් නාද වේ',
  idle: 'නිශ්චල',

  startTodaysSchedule: 'අද වැඩසටහන ආරම්භ කරන්න',
  stopTodaysSchedule: 'අද වැඩසටහන නවත්වන්න',
  addSchedule: 'කාලසටහන එක් කරන්න',

  colTime: 'වේලාව',
  colLabel: 'අවස්ථාව',
  colAudio: 'ශ්‍රව්‍ය',
  colStatus: 'තත්වය',
  colActions: 'කටයුතු',
  statusActive: 'සක්‍රිය',
  statusInactive: 'අක්‍රිය',

  overlayNowPlaying: 'දැන් නාද වේ',
  overlayUpNext: 'ඊළඟට',
  overlaySchedule: 'කාලසටහන',
  /** Table overlay when armed but no upcoming slot remains today */
  overlayNoNextEventHeading: 'ඊළඟ අවස්ථාව',
  overlayNoNextEventBody: 'අදට ඊළඟ සිදුවීමක් නොමැත',
  overlayNoMoreToday: 'අද වෙනත් අවස්ථා නැත',

  dialogEditSchedule: 'කාලසටහන සංස්කරණය',
  dialogAddSchedule: 'කාලසටහන එක් කරන්න',
  whenToPlay: 'නාද වන වේලාව',
  timePickerHelper: 'පෙ.ව/ප.ව සමඟ 12 පැය ඔරලෝසුව — ලැයිස්තුවේ දක්නා වේලාවම',
  timePickerAria: 'කාලසටහන වේලාව',
  fieldLabel: 'අවස්ථාව',
  nameInList: 'ලැයිස්තුවේ පෙනෙන නම',
  namePlaceholder: 'උදා: සිනුව, රැස්වීම ආරම්භය',
  soundFile: 'ශ්‍රව්‍ය ගොනුව',
  chooseAudioFile: 'ශ්‍රව්‍ය ගොනුව තෝරන්න',
  selectedFile: 'තේරිණි:',
  audioFormatsHint: 'MP3, WAV හෝ බ්‍රව්සරයා විසින් සහාය දක්වන අනෙකුත් ශ්‍රව්‍ය',
  preview: 'පෙරදසුන',
  testPlayHint:
    'පරීක්ෂණ නාදය මෙම ටැබයේ කාල නාදය සක්‍රිය කරයි (පේළියේ නාද හෝ අද වැඩසටහන මෙන්).',
  testPlay: 'පරීක්ෂණ නාද',
  stop: 'නවත්වන්න',
  enabled: 'සක්‍රිය',
  cancel: 'අවලංගු',
  save: 'සුරකින්න',

  playingDialogTitle: 'ශ්‍රව්‍ය නාද වේ',
  playingLabel: 'නාද වන්නේ:',
  playingTime: 'වේලාව:',

  noActiveSchedulesTitle: 'සක්‍රිය කාලසටහන නැත',
  closeCountdown: (seconds) =>
    `සක්‍රිය කාලසටහනක් නැත. තත්පර ${seconds} කින් යෙදුම ස්වයං වසනු ඇත.`,
  keepAppOpenQuestion: 'සක්‍රිය කාලසටහන නොමැත. යෙදුම විවෘතව තබා ගැනීමට අවශ්‍යද?',
  keepOpen: 'විවෘතව තබන්න',

  stopAudio: 'නාද නවත්වන්න',
  ariaPlaySchedule: 'කාලසටහන නාද කරන්න',
  ariaStopSchedule: 'නාද නවත්වන්න',

  testAudioDefaultLabel: 'පරීක්ෂණ ශ්‍රව්‍ය',

  /** Bottom-right Developer (English) */
  developerButton: 'Developer',
  developerDialogTitle: 'Developer — Contact',
  developerNameLabel: 'Name',
  developerEmailLabel: 'Email',
  developerPhoneLabel: 'Contact',
  developerPositionLabel: 'Position',
  developerNameValue: 'Isuru Lakshan Ketawala',
  /** Typo “gamil” corrected to gmail for a working mail link */
  developerEmailValue: 'lakshanisuru170@gmail.com',
  developerPhoneValue: '0716527880',
  developerPositionValue: 'Software Engineer',
  developerClose: 'Close',
};

export default UI;
