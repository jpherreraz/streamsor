import axios from 'axios';
import { cloudflareAccountId, cloudflareApiToken } from '../stream/checkCloudflareWithRetry';

export const getCloudflareAPI = () => {
  return axios.create({
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream`,
    headers: {
      'Authorization': `Bearer ${cloudflareApiToken.value()}`,
      'Content-Type': 'application/json',
    },
  });
}; 