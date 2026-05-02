import client from './client';

export const assistantApi = {
  chat: ({ studyId, page, question, conversation }) =>
    client.post('/api/assistant/chat', {
      study_id: studyId,
      page,
      question,
      conversation,
    }).then((r) => r.data),
};
