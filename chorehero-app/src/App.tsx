import React from 'react';
import DevelopmentApp from './DevelopmentApp';
import MainApp from './MainApp';
import TrustFirstApp from './variations/trust-first/App';

const isDevelopmentMode = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
const showTrustFirstVariation = true; // Set to true to show Trust-First variation

export default function App() {
  // Show Trust-First variation for demo
  if (showTrustFirstVariation) {
    return <TrustFirstApp />;
  }
  
  // In development mode, show the development app
  // In production mode, show the full app with navigation
  return isDevelopmentMode ? <DevelopmentApp /> : <MainApp />;
}