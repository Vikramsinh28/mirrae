import { axios } from '@/lib/utils';

export type TryOnStatusResponse =
  | { status: 'queued' | 'processing' }
  | { status: 'done'; resultUrl: string }
  | { status: 'failed'; error: string };

export interface CreateTryOnParams {
  personImageKey: string;
  productImageKey: string;
  consent: true;
}

export const createTryOn = async (params: CreateTryOnParams): Promise<{ jobId: string }> => {
  const response = await axios.post('/tryon/create', params);
  if (!response.data) throw new Error('No Data was sent in Response');
  return response.data.data as { jobId: string };
};

export const getTryOnStatus = async (jobId: string): Promise<TryOnStatusResponse> => {
  const response = await axios.get('/tryon/status', { params: { jobId } });
  if (!response.data) throw new Error('No Data was sent in Response');
  return response.data.data as TryOnStatusResponse;
};
