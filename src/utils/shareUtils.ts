import { Share } from'react-native';

export const sharePDF = async (pdfUrl: string) => {
  try {
    const result = await Share.open({
      url: pdfUrl,
      type: 'application/pdf',
      message: 'Please find the attached PDF health report for your pet.',
    });
    console.log(result);
  } catch (error) {
    console.error('Error sharing PDF:', error);
  }
};