import React from 'react';
import DevelopmentApp from './DevelopmentApp';
import MainApp from './MainApp';

const isDevelopmentMode = process.env.EXPO_PUBLIC_DEV_MODE === 'true';

export default function App() {
  // In development mode, show the development app
  // In production mode, show the full app with navigation
  return isDevelopmentMode ? <DevelopmentApp /> : <MainApp />;
}