import * as pdfLib from 'pdf-lib';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const generatePDF = async (data: any): Promise<string> => {
  const { petInfo, healthScore, weightChart, activeMedications, upcomingAppointments, recentRecords } = data;

  const doc = await pdfLib.PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size

  const timesRomanFont = await pdfLib.embedStandardFont(doc, 'Times-Roman');
  const timesRomanFontBold = await pdfLib.embedStandardFont(doc, 'Times-Bold');

  const fontSize = 12;
  let y = 750;

  // Add pet info header
  page.drawText(petInfo.name, { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 20;
  page.drawText(`Species: ${petInfo.species}`, { x: 50, y, size: fontSize, font: timesRomanFont });
  y -= 20;
  page.drawText(`Breed: ${petInfo.breed}`, { x: 50, y, size: fontSize, font: timesRomanFont });
  y -= 20;
  page.drawText(`Age: ${petInfo.age}`, { x: 50, y, size: fontSize, font: timesRomanFont });
  y -= 40;

  // Add health score
  page.drawText(`Health Score: ${healthScore}`, { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 40;

  // Add weight chart
  page.drawText('Weight Chart:', { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 20;
  weightChart.forEach((entry: any) => {
    page.drawText(`${entry.date}: ${entry.weight} kg`, { x: 50, y, size: fontSize, font: timesRomanFont });
    y -= 20;
  });
  y -= 40;

  // Add active medications
  page.drawText('Active Medications:', { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 20;
  activeMedications.forEach((medication: string) => {
    page.drawText(medication, { x: 50, y, size: fontSize, font: timesRomanFont });
    y -= 20;
  });
  y -= 40;

  // Add upcoming appointments
  page.drawText('Upcoming Appointments:', { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 20;
  upcomingAppointments.forEach((appointment: any) => {
    page.drawText(`${appointment.date}, ${appointment.time}: ${appointment.description}`, { x: 50, y, size: fontSize, font: timesRomanFont });
    y -= 20;
  });
  y -= 40;

  // Add recent records
  page.drawText('Recent Records:', { x: 50, y, size: fontSize, font: timesRomanFontBold });
  y -= 20;
  recentRecords.forEach((record: any) => {
    page.drawText(`${record.date}: ${record.description}`, { x: 50, y, size: fontSize, font: timesRomanFont });
    y -= 20;
  });

  const pdfBytes = await doc.save();
  const filePath = join(__dirname, `../public/${uuidv4()}.pdf`);
  const writeStream = createWriteStream(filePath);
  writeStream.write(pdfBytes);
  writeStream.end();

  return `/public/${uuidv4()}.pdf`;
};