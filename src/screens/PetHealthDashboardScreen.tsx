import React, { useState } from'react';
import { Button, View, Text } from'react-native';
import { useNavigation } from '@react-navigation/native';
import { generatePDF } from '../services/pdfService';
import { sharePDF } from '../utils/shareUtils';

const PetHealthDashboardScreen = () => {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleShare = async () => {
    setLoading(true);
    try {
      const pdfUrl = await generatePDF();
      // Share the PDF using the share handler
      if (pdfUrl) {
        await sharePDF(pdfUrl);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
    setLoading(false);
  };

  return (
    <View>
      <Text>Pet Health Dashboard</Text>
      <Button
        title="Generate and Share PDF"
        onPress={handleShare}
        disabled={loading}
      />
    </View>
  );
};

export default PetHealthDashboardScreen;