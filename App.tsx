import React, { useEffect } from'react';
import { configurePushNotifications } from './src/services/emergencyService';

export default function App() {
  useEffect(() => {
    configurePushNotifications();
  }, []);

  return (
    // Your app components
  );
}