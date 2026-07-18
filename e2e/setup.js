beforeAll(async () => {
  await device.launchApp({ permissions: { notifications: 'YES' }, delete: true });
});