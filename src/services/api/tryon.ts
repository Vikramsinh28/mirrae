import { axios } from '@/lib/utils';

/** 'single' = front view (1 credit); 'multi' = front + side + back (2 credits). */
export type TryOnViewsOption = 'single' | 'multi';

export interface TryOnDoneResponse {
  status: 'done';
  /** Front view. */
  resultUrl: string;
  sideUrl?: string;
  backUrl?: string;
  viewCount: number;
  /** True while the side and back views are still being generated. */
  extrasPending: boolean;
}

export type TryOnStatusResponse =
  | { status: 'queued' | 'processing' }
  | TryOnDoneResponse
  | { status: 'failed'; error: string };

export interface CreateTryOnParams {
  personImageKey: string;
  productImageKey: string;
  views?: TryOnViewsOption;
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
