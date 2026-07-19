import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';

// Configuration
const FITBARK_CLIENT_ID = process.env.FITBARK_CLIENT_ID;
const FITBARK_CLIENT_SECRET = process.env.FITBARK_CLIENT_SECRET;
const WHISTLE_API_KEY = process.env.WHISTLE_API_KEY;

// FitBark OAuth URL
const FITBARK_OAUTH_URL = 'https://app.fitbark.com/oauth/authorize';
const FITBARK_TOKEN_URL = 'https://app.fitbark.com/oauth/token';
const FITBARK_ACTIVITY_URL = 'https://app.fitbark.com/api/v1/activity/daily';

// Whistle API URLs
const WHISTLE_API_BASE_URL = 'https://api.whistle.com/v1';
const WHISTLE_GPS_URL = `${WHISTLE_API_BASE_URL}/gps`;
const WHISTLE_ACTIVITY_URL = `${WHISTLE_API_BASE_URL}/activity`;

// OAuth2 client for FitBark
const fitbarkOAuthClient = new OAuth2Client(FITBARK_CLIENT_ID, FITBARK_CLIENT_SECRET);

// Function to get FitBark OAuth access token
async function getFitBarkAccessToken(code: string): Promise<string> {
  try {
    const { tokens } = await fitbarkOAuthClient.getToken(code);
    return tokens.access_token;
  } catch (error) {
    console.error('Error getting FitBark access token:', error);
    throw new Error('Failed to get FitBark access token');
  }
}

// Function to fetch daily activity from FitBark
async function fetchFitBarkActivity(accessToken: string): Promise<any> {
  try {
    const response = await axios.get(FITBARK_ACTIVITY_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching FitBark activity:', error);
    throw new Error('Failed to fetch FitBark activity');
  }
}

// Function to fetch GPS and activity data from Whistle
async function fetchWhistleData(): Promise<any> {
  try {
    const response = await axios.get(WHISTLE_GPS_URL, {
      headers: {
        'x-api-key': WHISTLE_API_KEY,
      },
    });
    const gpsData = response.data;

    const activityResponse = await axios.get(WHISTLE_ACTIVITY_URL, {
      headers: {
        'x-api-key': WHISTLE_API_KEY,
      },
    });
    const activityData = activityResponse.data;

    return { gpsData, activityData };
  } catch (error) {
    console.error('Error fetching Whistle data:', error);
    throw new Error('Failed to fetch Whistle data');
  }
}

// Function to sync data to Health Dashboard timeline
async function syncDataToHealthDashboard(fitbarkData: any, whistleData: any): Promise<void> {
  // Implement the logic to sync data to the Health Dashboard timeline
  console.log('Syncing data to Health Dashboard...');
  console.log('FitBark Data:', fitbarkData);
  console.log('Whistle Data:', whistleData);
}

// Function to handle the connection and data syncing
export async function connectAndSyncWearables(code: string): Promise<void> {
  try {
    // Step 1: Get FitBark access token
    const fitbarkAccessToken = await getFitBarkAccessToken(code);

    // Step 2: Fetch FitBark activity data
    const fitbarkData = await fetchFitBarkActivity(fitbarkAccessToken);

    // Step 3: Fetch Whistle GPS and activity data
    const whistleData = await fetchWhistleData();

    // Step 4: Sync data to Health Dashboard
    await syncDataToHealthDashboard(fitbarkData, whistleData);

    // Step 5: Update UI (Settings screen)
    updateConnectedDevicesUI();
  } catch (error) {
    console.error('Error connecting and syncing wearables:', error);
    // Graceful error handling
    handleConnectionError(error);
  }
}

// Function to update the 'Connected Devices' section in the Settings screen
function updateConnectedDevicesUI() {
  // Implement the logic to update the UI
  console.log('Updating Connected Devices section in Settings screen...');
}

// Function to handle connection errors
function handleConnectionError(error: any) {
  // Implement the logic to handle connection errors
  console.error('Connection error:', error.message);
  alert('Failed to connect to wearable devices. Please check your API keys and try again.');
}

// Example usage
// connectAndSyncWearables('your_oauth_code_here');
