import React, { useState } from'react';
import axios from 'axios';

const SymptomCheckerScreen: React.FC = () => {
  const [petId, setPetId] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/predictions/symptoms', { petId, species, breed, symptoms });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    }

    setLoading(false);
  };

  return (
    <div>
      <h1>Symptom Checker</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Pet ID:</label>
          <input type="text" value={petId} onChange={(e) => setPetId(e.target.value)} />
        </div>
        <div>
          <label>Species:</label>
          <input type="text" value={species} onChange={(e) => setSpecies(e.target.value)} />
        </div>
        <div>
          <label>Breed:</label>
          <input type="text" value={breed} onChange={(e) => setBreed(e.target.value)} />
        </div>
        <div>
          <label>Symptoms:</label>
          <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)}></textarea>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Submit'}
        </button>
      </form>
      {error && <p style={{ color:'red' }}>{error}</p>}
      {result && (
        <div>
          <h2>Results</h2>
          <p><strong>Urgency:</strong> {result.urgency}</p>
          <p><strong>Probable Conditions:</strong> {result.probableConditions.join(', ')}</p>
          <p><strong>Recommended Actions:</strong> {result.recommendedActions.join(', ')}</p>
        </div>
      )}
    </div>
  );
};

export default SymptomCheckerScreen;