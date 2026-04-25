import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import './index.css';
import App from './App';
import { pickerLocaleText } from './uiStrings';

/**
 * Do not set adapterLocale to "si" for Dayjs + MUI TimePicker: Sinhala locale can break
 * keyboard entry for hours/minutes (0–59). Labels stay Sinhala via pickerLocaleText.
 */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LocalizationProvider dateAdapter={AdapterDayjs} localeText={pickerLocaleText}>
      <App />
    </LocalizationProvider>
  </React.StrictMode>
);
