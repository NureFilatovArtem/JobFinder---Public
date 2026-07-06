import client from './client';

export const applicationsAPI = {
  getAll: () => client.get('/applications').then(r => r.data),
  update: (vacancyId, data) => client.patch(`/applications/${vacancyId}`, data).then(r => r.data),
  getEmails: (vacancyId) => client.get(`/applications/${vacancyId}/emails`).then(r => r.data),
  saveEmail: (vacancyId, data) => client.post(`/applications/${vacancyId}/emails`, data).then(r => r.data),
  updateEmail: (vacancyId, emailId, data) => client.patch(`/applications/${vacancyId}/emails/${emailId}`, data).then(r => r.data),
  generateEmail: (vacancyId, data) => client.post(`/applications/${vacancyId}/emails/generate`, data).then(r => r.data),
  sendEmail: (vacancyId, emailId, gmailAccountId) =>
    client.post(`/applications/${vacancyId}/emails/${emailId}/send`, { gmail_account_id: gmailAccountId }).then(r => r.data),
  getAnalytics: () => client.get('/applications/analytics').then(r => r.data),
  getGmailStatus: () => client.get('/applications/gmail/status').then(r => r.data),
  // mode: 'manual' | 'lightweight' | 'full' — controls which Gmail scopes are requested.
  getGmailConnectUrl: (mode = 'manual') =>
    client.get('/applications/gmail/connect', { params: { mode } }).then(r => r.data),
  disconnectGmail: (accountId) => client.delete(`/applications/gmail/${accountId}`).then(r => r.data),
  // Mode 2 lightweight tracking: scan tracked threads for replies.
  checkReplies: () => client.post('/applications/check-replies').then(r => r.data),
};
