function pkceChallenge() {
  return {
    code_verifier: 'mock_verifier_123456789012345678901234567890',
    code_challenge: 'mock_challenge_123456789012345678901234567890',
  };
}
pkceChallenge.default = pkceChallenge;
module.exports = pkceChallenge;
