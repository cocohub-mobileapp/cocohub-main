// Clear all emergency contacts so the "no contacts" scenario can be tested.
http && http.mock('GET', '/api/emergency/contacts', {
  status: 200,
  body: JSON && JSON.stringify([]),
  headers: { 'Content-Type': 'application/json' },
});
