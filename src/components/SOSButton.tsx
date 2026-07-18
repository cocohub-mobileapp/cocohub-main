import React from'react';
import { Button, View } from'react-native';

const SOSButton: React.FC = () => {
  const handlePress = () => {
    // Implement your SOS logic here, similar to triggerSOS in emergencyService.ts
    console.log("SOS Triggered from button!");
  };

  return (
    <View>
      <Button title="SOS" onPress={handlePress} color="red" />
    </View>
  );
};

export default SOSButton;
